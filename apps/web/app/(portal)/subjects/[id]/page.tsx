import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/lib/markdown';
import { isUuid, opensBatch, requireMember } from '@/lib/tenant';
import { addChapter, deleteChapter, moveChapter, renameChapter } from '../../actions';
import { Flash, type Search } from '../../flash';
import { resolveReport } from './actions';

type Topic = { id: string; name: string; position: number; subtopics: { count: number }[] };
type Report = { id: string; question: string; answer: string; reason: string | null; created_at: string };

// A subject lists its topics (table chapters, ADR-038); each topic page holds the notes and Smart Study.
export default async function SubjectWorkspace(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const m = await requireMember();
  const { institute, member, db } = m;
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  // RLS: staff see every subject of the institute; students only subjects of their own (current or past) batches.
  const { data: subject } = await db
    .from('subjects')
    .select('id, name, batch_id, batches(name), chapters(id, name, position, subtopics(count))')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!subject || !(await opensBatch(m, subject.batch_id))) notFound();
  const topics = [...(subject.chapters as unknown as Topic[])].sort((a, b) => a.position - b.position);
  const student = member.role === 'student';
  // Staff review reported answers here; they never see the chats themselves (ADR-015).
  const { data: reportRows } = student
    ? { data: [] }
    : await db
        .from('answer_reports')
        .select('id, question, answer, reason, created_at')
        .eq('institute_id', institute.id)
        .eq('subject_id', id)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
  const reports = (reportRows ?? []) as Report[];
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={student ? '/home' : '/subjects'}>{student ? 'Home' : 'Subjects'}</Link> ·{' '}
            {(subject.batches as unknown as { name: string }).name}
          </p>
          <h1>{subject.name}</h1>
          <p className="muted">
            {topics.length} topic{topics.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      <section className="card stack" aria-labelledby="topics">
        <h2 id="topics">Topics</h2>
        {topics.length === 0 && (
          <p className="empty">{student ? 'Your teachers have not added topics yet.' : 'No topics yet.'}</p>
        )}
        <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
          {topics.map((c, i) => (
            <li key={c.id}>
              <div className="row">
                <Link href={`/topics/${c.id}`}>{c.name}</Link>
                <span className="small muted">
                  {c.subtopics[0]?.count ?? 0} subtopic{c.subtopics[0]?.count === 1 ? '' : 's'}
                </span>
              </div>
              {!student && (
                <div className="row small">
                  <form action={renameChapter} className="row">
                    <input type="hidden" name="subject_id" value={subject.id} />
                    <input type="hidden" name="chapter_id" value={c.id} />
                    <label className="sr-only" htmlFor={`c-${c.id}`}>
                      Topic name
                    </label>
                    <input id={`c-${c.id}`} name="name" defaultValue={c.name} required maxLength={200} />
                    <button type="submit">Rename</button>
                  </form>
                  <form action={moveChapter}>
                    <input type="hidden" name="subject_id" value={subject.id} />
                    <input type="hidden" name="chapter_id" value={c.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" disabled={i === 0} aria-label={`Move ${c.name} up`}>
                      ↑
                    </button>
                  </form>
                  <form action={moveChapter}>
                    <input type="hidden" name="subject_id" value={subject.id} />
                    <input type="hidden" name="chapter_id" value={c.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button type="submit" disabled={i === topics.length - 1} aria-label={`Move ${c.name} down`}>
                      ↓
                    </button>
                  </form>
                  <form action={deleteChapter}>
                    <input type="hidden" name="subject_id" value={subject.id} />
                    <input type="hidden" name="chapter_id" value={c.id} />
                    <button type="submit" className="link" aria-label={`Delete ${c.name}`}>
                      Delete
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!student && (
          <form action={addChapter} className="inline">
            <input type="hidden" name="subject_id" value={subject.id} />
            <label>
              New topic
              <input name="name" required maxLength={200} placeholder="Probability" />
            </label>
            <button type="submit">Add topic</button>
          </form>
        )}
      </section>
      {!student && (
        <section className="card stack" aria-labelledby="reports">
          <h2 id="reports">Reported answers ({reports.length})</h2>
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
        </section>
      )}
    </>
  );
}
