import Link from 'next/link';
import { CBT_WARNINGS, formatDuration, formatTime, pct, requestTime, testPhase } from '@/lib/assess';
import { studentBatches } from '@/lib/student';
import type { requireMember } from '@/lib/tenant';
import { startAttempt } from '../actions';
import { CbtStart, Runner, type RunnerQuestion } from './runner';
import type { Test } from './staff-test';

type Ctx = Awaited<ReturnType<typeof requireMember>>;
type Review = {
  question_id: string;
  pos: number;
  type: string;
  stem: string;
  options: { id: string; text: string }[];
  explanation: string;
  response: unknown;
  // null before release: objective keys come at closing time, the model answer with release (ADR-046)
  key: {
    correct?: string[];
    value?: number;
    tolerance_abs?: number;
    tolerance_pct?: number;
    model_answer?: string;
  } | null;
  marks: number;
  marks_awarded: number | null; // null = written answer not checked yet
  teacher_comment: string | null;
};

const letters = (ids: unknown) =>
  Array.isArray(ids) && ids.length ? ids.map((i) => String(i).toUpperCase()).join(', ') : null;

function shown(type: string, response: unknown) {
  if (response == null) return null;
  if (type === 'single' || type === 'multi') return letters(response);
  return String(response);
}

function answerKey(r: Review) {
  if (!r.key) return '';
  if (r.type === 'written') return r.key.model_answer ?? '';
  if (r.type === 'numerical') {
    const tol = r.key.tolerance_abs
      ? ` (± ${r.key.tolerance_abs})`
      : r.key.tolerance_pct
        ? ` (± ${r.key.tolerance_pct}%)`
        : '';
    return `${r.key.value}${tol}`;
  }
  return letters(r.key.correct) ?? '';
}

const START_ERRORS: Record<string, string> = { closed: 'This test is not open right now.' };
// Also the answer to ?error=past_batch (start refused): the body shows it, so it is not in START_ERRORS.
const PAST_BATCH = 'You have moved to a new batch, so tests of this batch can no longer be started.';

// Same rule as start_attempt's not_current_member: the student must still be in one of the test's batches.
async function inCurrentBatch({ db }: Ctx, testId: string) {
  const current = (await studentBatches()).list.filter((b) => !b.leftAt).map((b) => b.id);
  const { data, error } = await db
    .from('test_audience')
    .select('batch_id')
    .eq('test_id', testId)
    .in('batch_id', current)
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}

export async function StudentTest({ ctx, test, error }: { ctx: Ctx; test: Test; error?: string }) {
  const { db, member } = ctx;
  const phase = testPhase(test);
  const { data: attempt } = await db
    .from('test_attempts')
    .select('id, status, deadline_at, score, max_score, rank, started_at, submitted_at, cbt_warnings')
    .eq('test_id', test.id)
    .eq('user_id', member.userId)
    .maybeSingle();
  const inProgress = attempt?.status === 'in_progress' && Date.parse(attempt.deadline_at) > requestTime();

  let body: React.ReactNode;
  if (phase === 'cancelled') body = <p className="empty">This test was cancelled.</p>;
  else if (inProgress) {
    const { data: questions } = await db.rpc('get_attempt_questions', { a: attempt!.id });
    body = (
      <Runner
        testId={test.id}
        attemptId={attempt!.id}
        deadline={attempt!.deadline_at}
        serverNow={new Date().toISOString()}
        questions={(questions ?? []) as RunnerQuestion[]}
        cbt={test.cbt}
        warnings={attempt!.cbt_warnings}
      />
    );
  } else if (attempt) body = <ReviewView ctx={ctx} attempt={attempt} test={test} released={phase === 'released'} />;
  else if (phase === 'open' && !(await inCurrentBatch(ctx, test.id))) body = <p className="notice">{PAST_BATCH}</p>;
  else if (phase === 'open')
    body = (
      <section className="card stack">
        <p>
          You have <b>{formatDuration(test.duration_seconds)}</b> once you start (the test closes at{' '}
          {formatTime(test.closes_at)}, whichever comes first). Answers save automatically; if your internet drops, come
          back to this page and continue.
        </p>
        {test.cbt && (
          <p className="notice">
            <b>CBT test:</b> it runs in full screen. Leaving full screen or switching to another tab or app is a
            warning; on warning {CBT_WARNINGS} your test is submitted automatically. Use Google Chrome.
          </p>
        )}
        <form action={startAttempt}>
          <input type="hidden" name="test_id" value={test.id} />
          {test.cbt ? (
            <CbtStart />
          ) : (
            <button type="submit" className="primary">
              Start test
            </button>
          )}
        </form>
      </section>
    );
  else if (phase === 'upcoming') body = <p className="notice">Opens {formatTime(test.opens_at)}.</p>;
  else body = <p className="empty">You did not take this test. A missed test counts as 0% in your overall rank.</p>;

  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/home">Home</Link>
          </p>
          <h1>{test.title}</h1>
          <p className="muted">
            {formatTime(test.opens_at)} – {formatTime(test.closes_at)} · {formatDuration(test.duration_seconds)}
          </p>
        </div>
      </div>
      {error && START_ERRORS[error] && (
        <p role="alert" className="alert">
          {START_ERRORS[error]}
        </p>
      )}
      {body}
    </>
  );
}

// Before release (ADR-046): own marks right after submit, keys after closing time, rank only with release.
async function ReviewView({
  ctx,
  attempt,
  test,
  released,
}: {
  ctx: Ctx;
  attempt: {
    id: string;
    status: string;
    score: number | null;
    max_score: number | null;
    rank: number | null;
    cbt_warnings: number;
  };
  test: Test;
  released: boolean;
}) {
  const { data, error } = await ctx.db.rpc('get_attempt_review', { a: attempt.id });
  if (error) throw error;
  const rows = (data ?? []) as Review[];
  const unchecked = rows.filter((r) => r.marks_awarded == null).length;
  const score = released ? attempt.score : rows.reduce((s, r) => s + Number(r.marks_awarded ?? 0), 0);
  const max = released ? attempt.max_score : rows.reduce((s, r) => s + Number(r.marks), 0);
  return (
    <>
      {attempt.cbt_warnings >= CBT_WARNINGS && (
        <p className="alert">
          Your test was submitted automatically after {CBT_WARNINGS} warnings for leaving full screen.
        </p>
      )}
      {!released && (
        <p className="notice">
          Submitted.{' '}
          {unchecked > 0
            ? `${unchecked === 1 ? '1 written answer is' : `${unchecked} written answers are`} not checked yet; your marks go up when your teacher checks ${unchecked === 1 ? 'it' : 'them'}. `
            : ''}
          Your test rank comes when your teachers release results.
        </p>
      )}
      <div className="grid">
        <div className="card stat">
          <span className="muted small">{unchecked > 0 ? 'Marks so far' : 'Marks'}</span>
          <b>
            {score} / {max}
          </b>
        </div>
        <div className="card stat">
          <span className="muted small">Percentage</span>
          <b>{pct(score, max)}%</b>
        </div>
        <div className="card stat">
          <span className="muted small">Test rank</span>
          <b>{released ? attempt.rank : 'After release'}</b>
        </div>
      </div>
      <p>
        <Link href="/progress">See your overall rank and progress</Link>
      </p>
      {rows.map((r, i) => (
        <section key={r.question_id} className="card stack" aria-labelledby={`r-${r.question_id}`}>
          <h2 id={`r-${r.question_id}`}>
            Question {i + 1}{' '}
            {r.marks_awarded == null ? (
              <span className="badge warn">Not checked yet</span>
            ) : (
              <span className={`badge ${r.marks_awarded >= r.marks ? 'good' : r.marks_awarded < 0 ? 'bad' : 'warn'}`}>
                {r.marks_awarded} / {r.marks}
              </span>
            )}
          </h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.stem}</p>
          {r.options.length > 0 && (
            <ul className="choices">
              {r.options.map((o) => (
                <li key={o.id}>
                  {o.id.toUpperCase()}. {o.text}
                </li>
              ))}
            </ul>
          )}
          <p>
            <b>Your answer:</b>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{shown(r.type, r.response) ?? 'Not answered'}</span>
          </p>
          {answerKey(r) && (
            <p>
              <b>{r.type === 'written' ? 'Model answer' : 'Correct answer'}:</b>{' '}
              <span style={{ whiteSpace: 'pre-wrap' }}>{answerKey(r)}</span>
            </p>
          )}
          {!r.key && r.type !== 'written' && (
            <p className="muted">Correct answer: shown after the test closes ({formatTime(test.closes_at)}).</p>
          )}
          {r.explanation && <p className="muted">{r.explanation}</p>}
          {r.teacher_comment && (
            <p className="notice">
              <b>Teacher&apos;s comment:</b> {r.teacher_comment}
            </p>
          )}
        </section>
      ))}
    </>
  );
}
