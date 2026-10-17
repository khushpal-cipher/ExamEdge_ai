import Link from 'next/link';
import { TYPE_SHORT } from '@/lib/assess';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { deleteQuestion } from '../tests/actions';
import { approveQuestion, generateQuestions } from './actions';
import { AiBadge } from './ai-badge';
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
    .select('id, name, batches(name), chapters(id, name, position)')
    .eq('institute_id', institute.id)
    .order('name');
  const list = (subjects ?? []).map((s) => ({
    ...s,
    name: `${s.name} · ${(s.batches as unknown as { name: string }).name}`,
    chapters: [...(s.chapters ?? [])].sort((a, b) => a.position - b.position),
  }));
  const subject = list.find((s) => s.id === wanted) ?? list[0];
  const { data: questions } =
    subject && isUuid(subject.id)
      ? await db
          .from('questions')
          .select(
            'id, type, stem, chapter_id, origin, status, verification, question_keys(question_id), test_questions(test_id)',
          )
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
          <section className="card stack" aria-labelledby="ai-questions">
            <h2 id="ai-questions">Make questions with AI</h2>
            {!subject.chapters.length ? (
              <p className="empty">Add a chapter to {subject.name} first.</p>
            ) : (
              <form action={generateQuestions} className="inline" aria-label="Make questions with AI">
                <input type="hidden" name="subject_id" value={subject.id} />
                <label>
                  Chapter
                  <select name="chapter_id" required>
                    {subject.chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select name="type">
                    <option value="single">MCQ — one correct</option>
                    <option value="multi">MCQ — more than one correct</option>
                    <option value="numerical">Numerical answer</option>
                  </select>
                </label>
                <label>
                  How many
                  <input name="count" type="number" min={1} max={20} defaultValue={10} required />
                </label>
                <label>
                  Difficulty
                  <select name="difficulty" defaultValue="medium">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <button type="submit">Generate</button>
              </form>
            )}
            <p className="small muted">
              Made by AI from the chapter&apos;s published notes. A second AI solves every question again without the
              answer key; if the two answers differ, the question is flagged and you must fix it before using it. Every
              AI question stays a draft until you approve it.
            </p>
          </section>
          <section className="card stack" aria-labelledby="new-question">
            <h2 id="new-question">New question</h2>
            <QuestionForm key={subject.id} subjects={list} subjectId={subject.id} />
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
                            {q.status === 'draft' && <AiBadge verification={q.verification} />}
                          </td>
                          <td>{TYPE_SHORT[q.type]}</td>
                          <td>{(q.chapter_id && chapterName.get(q.chapter_id)) || '—'}</td>
                          <td>{used}</td>
                          <td style={{ textAlign: 'right' }}>
                            {q.status === 'draft' && q.verification === 'dual_solve_agree' && (
                              <form action={approveQuestion}>
                                <input type="hidden" name="question_id" value={q.id} />
                                <input type="hidden" name="back" value={`/questions?subject=${subject.id}`} />
                                <button
                                  type="submit"
                                  className="link"
                                  aria-label={`Approve question: ${q.stem.slice(0, 40)}`}
                                >
                                  Approve
                                </button>
                              </form>
                            )}
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
