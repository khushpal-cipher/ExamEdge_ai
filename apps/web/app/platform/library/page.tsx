import Link from 'next/link';
import { createLibrarySubject } from '../actions';
import { adminPage, LibraryFlash } from './shared';

type Subject = {
  id: string;
  name: string;
  exams: { name: string };
  library_chapters: { library_topics: { id: string }[] }[];
};

export default async function Library({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const db = await adminPage();
  const [{ data: subjects }, { data: exams }] = await Promise.all([
    db.from('library_subjects').select('id, name, exams(name), library_chapters(library_topics(id))').order('name'),
    db.from('exams').select('id, name').order('name'),
  ]);
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/">Institutes</Link>
          </p>
          <h1>ExamEdge library</h1>
          <p className="muted">
            Exam → subject → chapter → topic. Items are drafted, reviewed by a named reviewer, then published to every
            institute that maps the subject.
          </p>
        </div>
      </div>
      <LibraryFlash searchParams={searchParams} />
      <section className="card">
        <h2>Subjects</h2>
        {!subjects?.length ? (
          <p className="empty">No library subjects yet.</p>
        ) : (
          <ul className="stack">
            {(subjects as unknown as Subject[]).map((s) => (
              <li key={s.id}>
                <Link href={`/library/${s.id}`}>
                  {s.exams.name} · {s.name}
                </Link>{' '}
                <span className="small muted">
                  {s.library_chapters.length} chapters,{' '}
                  {s.library_chapters.reduce((n, c) => n + c.library_topics.length, 0)} topics
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack" aria-labelledby="new-subject">
        <h2 id="new-subject">New library subject</h2>
        <form action={createLibrarySubject} className="inline">
          <label>
            Exam
            <select name="exam_id" required>
              {(exams ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input name="name" required maxLength={120} placeholder="Physics" />
          </label>
          <button type="submit" className="primary">
            Create subject
          </button>
        </form>
      </section>
    </>
  );
}
