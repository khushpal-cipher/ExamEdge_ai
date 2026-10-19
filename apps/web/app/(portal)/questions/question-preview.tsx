import Link from 'next/link';
import { Markdown, MathText } from '@/lib/markdown';
import { approveQuestion } from './actions';
import { AiBadge } from './ai-badge';

type Key = { correct?: string[]; value?: number; tolerance_abs?: number; model_answer?: string } | null;
type Second = { correct?: string[]; value?: number | null } | null;
export type PreviewQuestion = {
  id: string;
  stem: string;
  type: string;
  status: string;
  verification: string;
  options: { id: string; text: string }[] | null;
  explanation: string | null;
  question_keys: { key: Key; second_solve: Second } | null;
};

const shown = (a: Key | Second) =>
  a?.correct ? a.correct.map((c) => c.toUpperCase()).join(', ') : String(a?.value ?? '—');

// A question opened in place (founder, session 44): everything the edit page shows for checking, plus Approve, so a
// teacher reviewing an AI test does not leave the page. Editing still happens on the question's own page.
export function QuestionPreview({ q, label, back }: { q: PreviewQuestion; label: string; back: string }) {
  const key = q.question_keys?.key ?? null;
  const second = q.question_keys?.second_solve ?? null;
  const correct = new Set(key?.correct ?? []);
  const draft = q.status === 'draft';
  return (
    <details className="preview">
      <summary>
        <MathText text={label} />
        {draft && (
          <>
            {' '}
            <AiBadge verification={q.verification} />
          </>
        )}
      </summary>
      <div className="stack">
        <Markdown text={q.stem} />
        {!!q.options?.length && (
          <ol className="options">
            {q.options.map((o) => (
              <li key={o.id} className={correct.has(o.id) ? 'right' : undefined}>
                <b>{o.id.toUpperCase()}.</b> <MathText text={o.text} />
                {correct.has(o.id) && <span className="badge good">Correct</span>}
              </li>
            ))}
          </ol>
        )}
        {q.type === 'numerical' && (
          <p>
            Answer: <b>{key?.value ?? '—'}</b>
            {!!key?.tolerance_abs && ` (± ${key.tolerance_abs})`}
          </p>
        )}
        {q.type === 'written' && key?.model_answer && (
          <div>
            <p className="small muted">Model answer</p>
            <Markdown text={key.model_answer} />
          </div>
        )}
        {q.explanation && (
          <div>
            <p className="small muted">Explanation</p>
            <Markdown text={q.explanation} />
          </div>
        )}
        {draft && q.verification === 'dual_solve_disagree' && (
          <p className="alert">
            A second AI answered {shown(second)}, but the key says {shown(key)}. Approve only if the key is right;
            otherwise edit the question.
          </p>
        )}
        {draft && q.verification === 'unverified' && (
          <p className="small muted">The second AI check did not run for this question. Check it yourself.</p>
        )}
        <div className="row">
          {draft && (
            <form action={approveQuestion}>
              <input type="hidden" name="question_id" value={q.id} />
              <input type="hidden" name="back" value={back} />
              {/* Seen in full here, so a teacher may approve one the AI check did not pass (teacher_verified). */}
              {q.verification !== 'dual_solve_agree' && <input type="hidden" name="checked" value="1" />}
              <button type="submit" className="primary" aria-label={`Approve ${label}`}>
                Approve
              </button>
            </form>
          )}
          <Link href={`/questions/${q.id}`} className="button">
            Edit
          </Link>
        </div>
      </div>
    </details>
  );
}
