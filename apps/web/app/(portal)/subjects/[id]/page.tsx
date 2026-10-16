import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KIND } from '@/lib/library';
import { Markdown } from '@/lib/markdown';
import { isUuid, requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { DOCUMENT_STATUS, VERSION_STATUS } from '../../documents/status';
import { Upload } from '../../documents/upload';
import { resolveReport } from './actions';
import { Panes } from './panes';
import { Tutor, type ChatMessage } from './tutor';

type Doc = { id: string; title: string; status: string; chapter_id: string | null };
type LibraryChapter = {
  id: string;
  name: string;
  position: number;
  library_topics: { id: string; name: string; position: number; library_items: { id: string; kind: string }[] }[];
};
type Report = { id: string; question: string; answer: string; reason: string | null; created_at: string };

export default async function SubjectWorkspace(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { institute, member, db } = await requireMember();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  // RLS: staff see every subject of the institute; students only subjects of their own batches.
  const { data: subject } = await db
    .from('subjects')
    .select('id, name, library_subject_id, chapters(id, name, position)')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!subject) notFound();
  // ExamEdge library for the mapped subject: published items only (RLS); topics without one are hidden.
  const { data: libRows } = subject.library_subject_id
    ? await db
        .from('library_chapters')
        .select('id, name, position, library_topics(id, name, position, library_items(id, kind))')
        .eq('subject_id', subject.library_subject_id)
    : { data: [] };
  const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
  const library = ((libRows ?? []) as LibraryChapter[])
    .map((c) => ({ ...c, topics: c.library_topics.filter((t) => t.library_items.length).sort(byPosition) }))
    .filter((c) => c.topics.length)
    .sort(byPosition);
  const chapters = [...(subject.chapters as { id: string; name: string; position: number }[])].sort(
    (a, b) => a.position - b.position,
  );
  const student = member.role === 'student';
  // RLS: staff see every document of the institute; students only notes published to one of their batches.
  const { data: docRows } = await db
    .from('documents')
    .select('id, title, status, chapter_id')
    .eq('institute_id', institute.id)
    .eq('subject_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  const docs = (docRows ?? []) as Doc[];
  // Staff also see the latest file's processing state.
  const latest = new Map<string, string>();
  if (!student && docs.length) {
    const { data: versions } = await db
      .from('document_versions')
      .select('document_id, version, processing_status')
      .eq('institute_id', institute.id)
      .in(
        'document_id',
        docs.map((d) => d.id),
      )
      .order('version');
    for (const v of versions ?? []) latest.set(v.document_id as string, v.processing_status as string);
  }
  const chapterName = new Map(chapters.map((c) => [c.id, c.name]));
  // RLS: a chat is readable by its owner only; staff see reported answers, never chats (ADR-015).
  const [{ data: chat }, { data: reportRows }] = await Promise.all([
    db
      .from('conversations')
      .select('id, messages(id, role, content, citations, answer_labels, feedback, created_at)')
      .eq('institute_id', institute.id)
      .eq('subject_id', id)
      .eq('user_id', member.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    student
      ? Promise.resolve({ data: [] })
      : db
          .from('answer_reports')
          .select('id, question, answer, reason, created_at')
          .eq('institute_id', institute.id)
          .eq('subject_id', id)
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
  ]);
  const messages = ((chat?.messages ?? []) as (ChatMessage & { created_at: string })[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const reports = (reportRows ?? []) as Report[];
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={student ? '/home' : '/subjects'}>{student ? 'Home' : 'Subjects'}</Link>
          </p>
          <h1>{subject.name}</h1>
          <p className="muted">{chapters.length} chapters</p>
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      {chapters.length > 0 && (
        <ul className="pills" aria-label="Chapters">
          {chapters.map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      )}
      <Panes
        sources={
          <>
            <h2>Sources</h2>
            {docs.length === 0 && (
              <p className="empty">
                {student ? 'Your teachers have not published notes for this subject yet.' : 'No notes uploaded yet.'}
              </p>
            )}
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Notes">
              {docs.map((d) => {
                const chapter = d.chapter_id ? chapterName.get(d.chapter_id) : null;
                if (student)
                  return (
                    <li key={d.id}>
                      <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener">
                        {d.title}
                      </a>
                      {chapter && <div className="small muted">{chapter}</div>}
                    </li>
                  );
                const processing = latest.get(d.id);
                const [label, tone] =
                  processing && processing !== 'ready' ? VERSION_STATUS[processing]! : DOCUMENT_STATUS[d.status]!;
                return (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`}>{d.title}</Link> <span className={`badge ${tone}`}>{label}</span>
                    {chapter && <div className="small muted">{chapter}</div>}
                  </li>
                );
              })}
            </ul>
            {library.length > 0 && (
              <>
                <h3>ExamEdge library</h3>
                <p className="small muted">Reviewed reference material for this subject. The tutor uses it too.</p>
                {library.map((c) => (
                  <details key={c.id}>
                    <summary>{c.name}</summary>
                    <ul className="stack small" aria-label={`Library: ${c.name}`}>
                      {c.topics.map((t) => (
                        <li key={t.id}>
                          {t.name}:{' '}
                          {t.library_items.map((i, n) => (
                            <span key={i.id}>
                              {n > 0 && ' · '}
                              <a href={`/library/${i.id}`}>{KIND[i.kind]}</a>
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </>
            )}
            {!student && (
              <details>
                <summary>Upload notes</summary>
                <Upload subjectId={subject.id} chapters={chapters} />
              </details>
            )}
          </>
        }
        tutor={
          <>
            {!student && (
              <details open={reports.length > 0}>
                <summary>Reported answers ({reports.length})</summary>
                {reports.length === 0 && <p className="muted small">No open reports for this subject.</p>}
                <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label="Reported answers">
                  {reports.map((r) => (
                    <li key={r.id} className="card stack">
                      <p className="small muted">Question</p>
                      <p>{r.question}</p>
                      <p className="small muted">Answer</p>
                      <Markdown text={r.answer} />
                      {r.reason && <p className="small">Student&apos;s note: {r.reason}</p>}
                      <form action={resolveReport}>
                        <input type="hidden" name="report_id" value={r.id} />
                        <input type="hidden" name="subject_id" value={subject.id} />
                        <button type="submit">Resolve</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Tutor
              key={chat?.id ?? 'new'}
              subjectId={subject.id}
              subjectName={subject.name}
              conversationId={chat?.id ?? null}
              messages={messages}
            />
          </>
        }
        studio={
          <>
            <h2>Studio</h2>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {['Practice quiz', 'Flashcards', 'Summary', 'Mind map'].map((t) => (
                <div key={t} className="empty small">
                  <b>{t}</b>
                  <br />
                  Coming soon
                </div>
              ))}
            </div>
            <p className="small muted">Practice quizzes help you learn. They never affect your rank.</p>
          </>
        }
      />
    </>
  );
}
