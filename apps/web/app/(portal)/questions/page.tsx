import Link from 'next/link';
import { TYPE_SHORT } from '@/lib/assess';
import { isUuid, MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { deleteQuestion } from '../tests/actions';
import { approveQuestion } from './actions';
import { AiBadge } from './ai-badge';
import { Flash } from '../flash';
import { QuestionForm } from './question-form';

export default async function QuestionBank({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; ok?: string; error?: string }>;
}) {
  const { institute, member, db } = await requireMember(STAFF);
  const { subject: wanted } = await searchParams;
  const [{ data: subjects }, { data: mine }] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, batch_id, batches(name), chapters(id, name, position)')
      .eq('institute_id', institute.id)
      .order('name'),
    db.from('batch_members').select('batch_id').eq('institute_id', institute.id).eq('membership_id', member.id),
  ]);
  // Teachers see only subjects of the batches they teach (UI filter, as on the Subjects page; ADR-038).
  const teaching = new Set((mine ?? []).map((r) => r.batch_id));
  const manager = MANAGERS.includes(member.role);
  const list = (subjects ?? [])
    .filter((s) => manager || teaching.has(s.batch_id))
    .map((s) => ({
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
                      <th>Topic</th>
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
