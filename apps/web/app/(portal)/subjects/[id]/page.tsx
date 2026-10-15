import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { DOCUMENT_STATUS, VERSION_STATUS } from '../../documents/status';
import { Upload } from '../../documents/upload';
import { Panes } from './panes';

type Doc = { id: string; title: string; status: string; chapter_id: string | null };

export default async function SubjectWorkspace(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { institute, member, db } = await requireMember();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  // RLS: staff see every subject of the institute; students only subjects of their own batches.
  const { data: subject } = await db
    .from('subjects')
    .select('id, name, chapters(id, name, position)')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!subject) notFound();
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
            <h2>AI tutor · {subject.name}</h2>
            <p className="empty reading">
              The tutor answers from your institute&apos;s notes with page citations. It is switched on in a later
              release.
            </p>
            <form className="row" aria-label="Ask a doubt">
              <label className="sr-only" htmlFor="doubt">
                Your doubt
              </label>
              <input id="doubt" disabled placeholder={`Ask a doubt about ${subject.name}…`} style={{ flex: 1 }} />
              <button type="submit" className="primary" disabled>
                Ask
              </button>
            </form>
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
