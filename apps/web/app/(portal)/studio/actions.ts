'use server';

// Studio Server Functions (ADR-028). The institute comes from the host and every read/write runs in the user's own
// session, so RLS decides: students make private artifacts on their own subjects from notes published to them; staff
// make institute drafts and publish them to batches they teach.
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { AiBlocked } from '@examedge/core/ai/gateway';
import {
  generateArtifact,
  KINDS,
  SCHEMA_VERSION,
  STUDIO_PROMPT_VERSION,
  StudioError,
  validateArtifact,
  type Kind,
} from '@examedge/core/ai/studio';
import { log } from '@examedge/core/log';
import { webMeter } from '@/lib/meter';
import { chapterNotes } from '@/lib/notes';
import { textFields, withTexts } from '@/lib/studio';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { done } from '../form';

const back = (path: string, code: string): never => redirect(`${path}?error=${code}`);

export async function generate(form: FormData) {
  const { institute, member, db } = await requireMember();
  const subject = form.get('subject_id');
  const chapter = form.get('chapter_id');
  const kind = form.get('kind') as Kind;
  if (!isUuid(subject) || !isUuid(chapter)) redirect('/');
  const here = `/topics/${chapter}`;
  if (!KINDS.includes(kind)) back(here, 'invalid');
  const student = member.role === 'student';

  // RLS: the chapter is visible only if its subject is (students: subjects of their batches).
  const { data: ch } = await db
    .from('chapters')
    .select('id, name, subjects(name)')
    .eq('institute_id', institute.id)
    .eq('subject_id', subject)
    .eq('id', chapter)
    .maybeSingle();
  if (!ch) back(here, 'denied');
  // RLS: students read only notes published to their batches; generation uses published notes for staff too.
  // No notes yet → the AI writes from general knowledge of the topic, labelled as such (ADR-050).
  const { ids, sources } = await chapterNotes(db, institute.id, chapter as string);
  // Same kind, chapter and notes (chunk ids change when a note is replaced) → same artifact (AC9.2).
  const inputHash = createHash('sha256')
    .update(JSON.stringify([kind, chapter, [...ids].sort()]))
    .digest('hex');
  const scope = student ? 'student' : 'institute';
  const existing = async () => {
    let q = db
      .from('generated_artifacts')
      .select('id')
      .eq('institute_id', institute.id)
      .eq('owner_scope', scope)
      .eq('kind', kind)
      .eq('input_hash', inputHash)
      .eq('prompt_version', STUDIO_PROMPT_VERSION);
    if (student) q = q.eq('owner_user_id', member.userId);
    return (await q.maybeSingle()).data?.id as string | undefined;
  };
  const reuse = await existing();
  if (reuse) redirect(`/studio/${reuse}?ok=reused`);

  let made;
  try {
    const subjectName = (ch!.subjects as unknown as { name: string } | null)?.name;
    made = await generateArtifact(webMeter(db, institute.id), {
      kind,
      chapter: ch!.name,
      subject: subjectName,
      sources,
    });
  } catch (e) {
    if (e instanceof AiBlocked) back(here, e.reason);
    if (e instanceof StudioError) back(here, e.message === 'refused' ? 'refused' : 'no_sources');
    log.error('studio.generate_failed', { institute: institute.id, kind, error: e });
    back(here, 'generation_failed');
  }
  const { data: saved, error } = await db
    .from('generated_artifacts')
    .insert({
      institute_id: institute.id,
      owner_scope: scope,
      kind,
      subject_id: subject,
      chapter_id: chapter,
      source_refs: made!.sourceRefs,
      input_hash: inputHash,
      prompt_version: STUDIO_PROMPT_VERSION,
      model: made!.model,
      schema_version: SCHEMA_VERSION,
      content: made!.content,
      usage_record_id: made!.recordId || null,
    })
    .select('id')
    .single();
  // Two clicks at once: the other request stored it first.
  if (error?.code === '23505') redirect(`/studio/${await existing()}?ok=reused`);
  if (error) done(here, error);
  redirect(`/studio/${saved!.id}?ok=generated`);
}

type Artifact = { id: string; kind: Kind; content: unknown; source_refs: unknown[]; subject_id: string };

async function artifact(form: FormData, roles?: string[]) {
  const m = await requireMember(roles);
  const id = form.get('artifact_id');
  if (!isUuid(id)) redirect('/');
  const { data } = await m.db
    .from('generated_artifacts')
    .select('id, kind, content, source_refs, subject_id')
    .eq('institute_id', m.institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!data) back(`/studio/${id}`, 'denied');
  return { ...m, a: data as Artifact, path: `/studio/${id}` };
}

// Staff edit the generated text; the shape and the citations stay as generated, and the result is validated again.
export async function editArtifact(form: FormData) {
  const { institute, db, a, path } = await artifact(form, STAFF);
  const values = new Map<string, string>();
  for (const [key] of textFields(a.content)) {
    const v = form.get(key);
    if (typeof v === 'string') values.set(key, v.trim());
  }
  let content;
  try {
    content = validateArtifact(a.kind, withTexts(a.content, values), a.source_refs.length);
  } catch {
    back(path, 'invalid');
  }
  const { error } = await db
    .from('generated_artifacts')
    .update({ content })
    .eq('institute_id', institute.id)
    .eq('id', a.id);
  done(path, error, 'saved_draft');
}

export async function publishArtifact(form: FormData) {
  const { institute, db, a, path } = await artifact(form, STAFF);
  const wanted = new Set(form.getAll('batch_id').filter(isUuid));
  if (!wanted.size) done(path, { message: 'document_no_batches' });
  const { data: current, error: readError } = await db
    .from('artifact_audience')
    .select('batch_id')
    .eq('institute_id', institute.id)
    .eq('artifact_id', a.id);
  if (readError) done(path, readError);
  const have = new Set(current!.map((r) => r.batch_id as string));
  const add = [...wanted].filter((b) => !have.has(b));
  const remove = [...have].filter((b) => !wanted.has(b));
  if (add.length) {
    const rows = add.map((batch_id) => ({ institute_id: institute.id, artifact_id: a.id, batch_id }));
    const { error } = await db.from('artifact_audience').insert(rows);
    if (error) done(path, error);
  }
  if (remove.length) {
    const { error } = await db
      .from('artifact_audience')
      .delete()
      .eq('institute_id', institute.id)
      .eq('artifact_id', a.id)
      .in('batch_id', remove);
    if (error) done(path, error);
  }
  const { error } = await db
    .from('generated_artifacts')
    .update({ status: 'published' })
    .eq('institute_id', institute.id)
    .eq('id', a.id);
  done(path, error, 'published');
}

export async function withdrawArtifact(form: FormData) {
  const { institute, db, a, path } = await artifact(form, STAFF);
  const { error } = await db
    .from('generated_artifacts')
    .update({ status: 'withdrawn' })
    .eq('institute_id', institute.id)
    .eq('id', a.id);
  done(path, error, 'withdrawn');
}

// RLS: a student deletes only their own artifacts; staff delete institute artifacts.
export async function deleteArtifact(form: FormData) {
  const { institute, db, a } = await artifact(form);
  const { error, count } = await db
    .from('generated_artifacts')
    .delete({ count: 'exact' })
    .eq('institute_id', institute.id)
    .eq('id', a.id);
  done(`/subjects/${a.subject_id}`, error ?? (count ? null : { code: '42501' }), 'deleted');
}

// The database grades the quiz and records the try (submit_practice). The quiz page sends no answers to the browser;
// they come back only with the result.
export async function submitQuiz(artifactId: string, answers: Record<string, string>) {
  const { institute, db } = await requireMember(['student']);
  if (!isUuid(artifactId)) return null;
  const clean = Object.fromEntries(
    Object.entries(answers)
      .filter(([k, v]) => typeof v === 'string' && k.length <= 20 && v.length <= 20)
      .slice(0, 50),
  );
  const { data, error } = await db.rpc('submit_practice', { art: artifactId, answers: clean });
  if (error) return null;
  const r = data as {
    score: number;
    max_score: number;
    results: { id: string; choice: string | null; answer: string; correct: boolean; explanation?: string }[];
  };
  // Explanations give the answer away, so they are shown only now.
  const { data: a } = await db
    .from('generated_artifacts')
    .select('content')
    .eq('institute_id', institute.id)
    .eq('id', artifactId)
    .single();
  const why = new Map(
    ((a?.content as { questions?: { id: string; explanation: string }[] })?.questions ?? []).map((q) => [
      q.id,
      q.explanation,
    ]),
  );
  for (const x of r.results) x.explanation = why.get(x.id);
  return r;
}
