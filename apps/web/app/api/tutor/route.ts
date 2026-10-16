// AI tutor endpoint (AI_PIPELINE §4, ADR-026). Streams NDJSON lines: {t:'delta', text} while the answer is written,
// then {t:'done', message} or {t:'error', code}. The institute comes from the host and every read/write runs with the
// user's own session, so RLS limits retrieval to notes published to the student's batches (TH-02, TH-06).
import { z } from 'zod';
import { embed, toVector } from '@examedge/core/ai/embed';
import { AiBlocked, type Meter } from '@examedge/core/ai/gateway';
import { mergeLayers, tutorAnswer, type Passage } from '@examedge/core/ai/tutor';
import { log } from '@examedge/core/log';
import { webMeter } from '@/lib/meter';
import { supabase } from '@/lib/supabase';
import { currentHost, currentInstitute, currentMember } from '@/lib/tenant';
import { hostname } from '@/lib/host';

const NO_STORE = { 'cache-control': 'private, no-store' };
const fail = (status: number, code: string) => Response.json({ code }, { status, headers: NO_STORE });

const Body = z.object({
  subjectId: z.uuid(),
  conversationId: z.uuid().optional(),
  question: z.string().trim().min(1).max(2000),
  premium: z.boolean().default(false),
});

type Db = Awaited<ReturnType<typeof supabase>>;

type Subject = { id: string; library_subject_id: string | null };
type NotesRow = Omit<Extract<Passage, { document_id: string }>, 'title'>;
type LibraryRow = { item_id: string; topic: string; content: string; score: number };

// Both layers with one query embedding: the institute's notes (RLS: published to the caller's batches) and, when the
// subject is mapped, the ExamEdge library (RLS: published items).
async function retrieve(db: Db, meter: Meter, subject: Subject, question: string): Promise<Passage[]> {
  const { vectors } = await embed(meter, 'query_embed', [question], 'query');
  const query = { query_embedding: toVector(vectors[0]!), query_text: question };
  const [notes, library] = await Promise.all([
    db.rpc('match_chunks', { ...query, subject: subject.id, k: 30 }),
    subject.library_subject_id
      ? db.rpc('match_library_chunks', { ...query, subject: subject.library_subject_id, k: 20 })
      : { data: [], error: null },
  ]);
  if (notes.error) throw notes.error;
  if (library.error) throw library.error;
  const chunks = notes.data as NotesRow[];
  const { data: docs } = chunks.length
    ? await db
        .from('documents')
        .select('id, title')
        .in('id', [...new Set(chunks.map((c) => c.document_id))])
    : { data: [] };
  const title = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));
  return mergeLayers(
    chunks.map((c) => ({ ...c, source_kind: 'institute', title: title.get(c.document_id) ?? 'Notes' })),
    (library.data as LibraryRow[]).map((r) => ({
      source_kind: 'library',
      library_item_id: r.item_id,
      title: r.topic,
      content: r.content,
      score: r.score,
    })),
  );
}

export async function POST(req: Request) {
  // Cookies are SameSite=Lax, and a JSON body cannot be sent cross-site without a CORS preflight; the origin check is
  // the explicit guard (route handlers do not get the Server Action origin check).
  const origin = URL.parse(req.headers.get('origin') ?? '');
  if (!origin || hostname(origin.host) !== (await currentHost())) return fail(403, 'bad_origin');
  const [institute, member] = await Promise.all([currentInstitute(), currentMember()]);
  if (!institute || institute.status === 'suspended' || !member?.role) return fail(404, 'not_found');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request');
  const { subjectId, conversationId, question, premium } = parsed.data;
  const db = await supabase();

  // RLS: a student only sees subjects of their own batches.
  const { data: subject } = await db
    .from('subjects')
    .select('id, library_subject_id')
    .eq('institute_id', institute.id)
    .eq('id', subjectId)
    .maybeSingle();
  if (!subject) return fail(404, 'not_found');
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  if (conversationId) {
    // RLS: only the owner of the conversation can read it.
    const { data: conv } = await db
      .from('conversations')
      .select('id, messages(role, content, created_at)')
      .eq('institute_id', institute.id)
      .eq('subject_id', subjectId)
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) return fail(404, 'not_found');
    history = (conv.messages as { role: 'user' | 'assistant'; content: string; created_at: string }[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ role, content }) => ({ role, content }));
  }

  const meter = webMeter(db, institute.id);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(line) + '\n'));
        } catch {
          // The student closed the page: the answer is still saved and the call settled.
        }
      };
      try {
        const answer = await tutorAnswer(
          meter,
          {
            institute: institute.id,
            question,
            history,
            premium,
            retrieve: () => retrieve(db, meter, subject as Subject, question),
          },
          (text) => send({ t: 'delta', text }),
        );
        // The chat is saved only once there is an answer, so a blocked question does not count as a doubt.
        let conv = conversationId;
        if (!conv) {
          const { data, error } = await db
            .from('conversations')
            .insert({ institute_id: institute.id, subject_id: subjectId, title: question.slice(0, 200) })
            .select('id')
            .single();
          if (error) throw error;
          conv = data.id as string;
        }
        const base = { institute_id: institute.id, conversation_id: conv };
        const { error: qError } = await db.from('messages').insert({ ...base, role: 'user', content: question });
        if (qError) throw qError;
        const labels = answer.paragraphs.map((p) => ({ label: p.label, citations: p.citations }));
        const { data: saved, error } = await db
          .from('messages')
          .insert({
            ...base,
            role: 'assistant',
            content: answer.content,
            citations: answer.citations,
            answer_labels: labels,
            model: answer.model,
            usage_record_id: answer.recordId || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        send({
          t: 'done',
          conversationId: conv,
          message: {
            id: saved.id,
            content: answer.content,
            citations: answer.citations,
            answer_labels: labels,
            refused: answer.refused,
          },
        });
      } catch (e) {
        if (e instanceof AiBlocked) send({ t: 'error', code: e.reason });
        else {
          log.error('tutor_failed', { institute: institute.id, error: e });
          send({ t: 'error', code: 'failed' });
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { ...NO_STORE, 'content-type': 'application/x-ndjson; charset=utf-8' } });
}
