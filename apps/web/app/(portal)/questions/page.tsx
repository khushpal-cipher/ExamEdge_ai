import Link from 'next/link';
import { TYPE_SHORT } from '@/lib/assess';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { deleteQuestion } from '../tests/actions';
import { Flash } from '../flash';
import { QuestionForm } from './question-form';

export default async function QuestionBank({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; ok?: string; error?: string }>;
}) {
  const { institute, db } = await requireMember(STAFF);
  const { subject: wanted } = await searchParams;
  const { data: subjects } = await db
    .from('subjects')
    .select('id, name, chapters(id, name, position)')
    .eq('institute_id', institute.id)
    .order('name');
  const list = (subjects ?? []).map((s) => ({
    ...s,
    chapters: [...(s.chapters ?? [])].sort((a, b) => a.position - b.position),
  }));
  const subject = list.find((s) => s.id === wanted) ?? list[0];
  const { data: questions } =
    subject && isUuid(subject.id)
      ? await db
          .from('questions')
          .select('id, type, stem, chapter_id, question_keys(question_id), test_questions(test_id)')
          .eq('institute_id', institute.id)
          .eq('subject_id', subject.id)
          .order('created_at', { ascending: false })
      : { data: [] };
  const chapterName = new Map(subject?.chapters.map((c) => [c.id, c.name]));

  return (
    <>
      <div className="top">
        <div>
          <h1>Question bank</h1>
          <p className="muted">MCQs, numerical and written questions. Tests are built from these.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {!subject ? (
        <p className="empty">
          No subjects yet. <Link href="/subjects">Add a subject</Link> first.
        </p>
      ) : (
        <>
          <nav aria-label="Subjects" className="row">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/questions?subject=${s.id}`}
                className={`button${s.id === subject.id ? ' primary' : ''}`}
                aria-current={s.id === subject.id ? 'page' : undefined}
              >
                {s.name}
              </Link>
            ))}
          </nav>
          <section className="card stack" aria-labelledby="new-question">
            <h2 id="new-question">New question</h2>
            <QuestionForm subjects={list} subjectId={subject.id} />
          </section>
          <section className="card stack" aria-labelledby="bank">
            <h2 id="bank">
              {subject.name} ({questions?.length ?? 0})
            </h2>
            {!questions?.length ? (
              <p className="empty">No questions in {subject.name} yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Chapter</th>
                      <th>Used in tests</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => {
                      const used = (q.test_questions as unknown[]).length;
                      return (
                        <tr key={q.id}>
                          <td>
                            <Link href={`/questions/${q.id}`}>
                              {q.stem.length > 90 ? `${q.stem.slice(0, 90)}…` : q.stem}
                            </Link>{' '}
                            {!(q.question_keys as unknown) && <span className="badge bad">No answer key</span>}
                          </td>
                          <td>{TYPE_SHORT[q.type]}</td>
                          <td>{(q.chapter_id && chapterName.get(q.chapter_id)) || '—'}</td>
                          <td>{used}</td>
                          <td style={{ textAlign: 'right' }}>
                            {used === 0 && (
                              <form action={deleteQuestion}>
                                <input type="hidden" name="question_id" value={q.id} />
                                <button
                                  type="submit"
                                  className="link"
                                  aria-label={`Delete question: ${q.stem.slice(0, 40)}`}
                                >
                                  Delete
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
