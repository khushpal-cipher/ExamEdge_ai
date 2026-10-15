import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, requireMember } from '@/lib/tenant';
import { Panes } from './panes';

export default async function SubjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { institute, member, db } = await requireMember();
  const { id } = await params;
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
            <p className="empty">
              {student ? 'Your teachers have not published notes for this subject yet.' : 'Notes upload arrives next.'}
            </p>
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
