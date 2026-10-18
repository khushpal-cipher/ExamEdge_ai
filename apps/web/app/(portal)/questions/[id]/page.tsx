import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { approveQuestion } from '../actions';
import { AiBadge } from '../ai-badge';
import { QuestionForm, type QuestionInit } from '../question-form';

type Answer = { correct?: string[]; value?: number | null } | null;
// "B, C" or "9.8"
const shown = (a: Answer) => (a?.correct ? a.correct.map((c) => c.toUpperCase()).join(', ') : String(a?.value ?? '—'));

export default async function EditQuestion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { institute, db } = await requireMember(STAFF);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data: q }, { data: subjects }] = await Promise.all([
    db
      .from('questions')
      .select(
        'id, subject_id, chapter_id, type, stem, options, explanation, difficulty, origin, status, verification, question_keys(key, second_solve), test_questions(test_id)',
      )
      .eq('institute_id', institute.id)
      .eq('id', id)
      .maybeSingle(),
    db
      .from('subjects')
      .select('id, name, batches(name), chapters(id, name, position)')
      .eq('institute_id', institute.id)
      .order('name'),
  ]);
  if (!q) notFound();
  const keys = q.question_keys as unknown as { key: QuestionInit['key']; second_solve: Answer } | null;
  const initial = { ...q, key: keys?.key ?? null } as QuestionInit;
  const review = q.origin === 'ai' && q.status === 'draft';
  const tests = q.test_questions as unknown as { test_id: string }[];
  const used = tests.length;
  // Opened from its only test (e.g. an AI test): saving or approving returns there.
  const back = used === 1 ? `/tests/${tests[0]!.test_id}` : undefined;
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/questions?subject=${q.subject_id}`}>Question bank</Link>
          </p>
          <h1>Edit question</h1>
          {used > 0 && (
            <p className="muted">
              Used in {used} test{used > 1 ? 's' : ''}. Once a test is scheduled, only the answer key and explanation
              can change; after results are released, use <b>Recalculate results</b> on the test.
            </p>
          )}
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {review && (
        <section className="card stack" aria-labelledby="ai-check">
          <h2 id="ai-check">
            AI-made question <AiBadge verification={q.verification} />
          </h2>
          <p>
            {q.verification === 'dual_solve_agree'
              ? 'A second AI solved this question without the answer key and got the same answer. Check it, then approve it as it is, or edit it below and save (saving approves it too).'
              : q.verification === 'dual_solve_disagree'
                ? `A second AI solved this question without the answer key and answered ${shown(keys?.second_solve ?? null)}, but the key says ${shown(keys?.key as Answer)}. Check which is right, fix the question or the key below, then save. Saving approves it.`
                : 'The second AI check did not run for this question. Check it yourself, fix it if needed, then save. Saving approves it.'}
          </p>
          {q.verification === 'dual_solve_agree' && (
            <form action={approveQuestion}>
              <input type="hidden" name="question_id" value={q.id} />
              <input type="hidden" name="back" value={back ?? `/questions/${q.id}`} />
              <button type="submit" className="primary">
                Approve as it is
              </button>
            </form>
          )}
        </section>
      )}
      <section className="card">
        <QuestionForm
          subjects={(subjects ?? []).map((s) => ({
            ...s,
            name: `${s.name} · ${(s.batches as unknown as { name: string }).name}`,
            chapters: [...(s.chapters ?? [])].sort((a, b) => a.position - b.position),
          }))}
          initial={initial}
          back={back}
        />
      </section>
    </>
  );
}
