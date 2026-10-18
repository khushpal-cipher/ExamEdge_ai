import Link from 'next/link';
import { formatDuration, formatTime, pct, requestTime, testPhase } from '@/lib/assess';
import { studentBatches } from '@/lib/student';
import type { requireMember } from '@/lib/tenant';
import { startAttempt } from '../actions';
import { Runner, type RunnerQuestion } from './runner';
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
  key: { correct?: string[]; value?: number; tolerance_abs?: number; tolerance_pct?: number; model_answer?: string };
  marks: number;
  marks_awarded: number;
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
    .select('id, status, deadline_at, score, max_score, rank, started_at, submitted_at')
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
      />
    );
  } else if (phase === 'released' && attempt) body = <ReviewView ctx={ctx} attempt={attempt} />;
  else if (attempt)
    body = (
      <p className="notice">
        Submitted. Your marks and rank appear here after your teachers check the written answers and release results.
      </p>
    );
  else if (phase === 'open' && !(await inCurrentBatch(ctx, test.id))) body = <p className="notice">{PAST_BATCH}</p>;
  else if (phase === 'open')
    body = (
      <section className="card stack">
        <p>
          You have <b>{formatDuration(test.duration_seconds)}</b> once you start (the test closes at{' '}
          {formatTime(test.closes_at)}, whichever comes first). Answers save automatically; if your internet drops, come
          back to this page and continue.
        </p>
        <form action={startAttempt}>
          <input type="hidden" name="test_id" value={test.id} />
          <button type="submit" className="primary">
            Start test
          </button>
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

async function ReviewView({
  ctx,
  attempt,
}: {
  ctx: Ctx;
  attempt: { id: string; score: number | null; max_score: number | null; rank: number | null };
}) {
  const { data } = await ctx.db.rpc('get_attempt_review', { a: attempt.id });
  const rows = (data ?? []) as Review[];
  return (
    <>
      <div className="grid">
        <div className="card stat">
          <span className="muted small">Marks</span>
          <b>
            {attempt.score} / {attempt.max_score}
          </b>
        </div>
        <div className="card stat">
          <span className="muted small">Percentage</span>
          <b>{pct(attempt.score, attempt.max_score)}%</b>
        </div>
        <div className="card stat">
          <span className="muted small">Test rank</span>
          <b>{attempt.rank}</b>
        </div>
      </div>
      <p>
        <Link href="/progress">See your overall rank and progress</Link>
      </p>
      {rows.map((r, i) => (
        <section key={r.question_id} className="card stack" aria-labelledby={`r-${r.question_id}`}>
          <h2 id={`r-${r.question_id}`}>
            Question {i + 1}{' '}
            <span className={`badge ${r.marks_awarded >= r.marks ? 'good' : r.marks_awarded < 0 ? 'bad' : 'warn'}`}>
              {r.marks_awarded} / {r.marks}
            </span>
          </h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.stem}</p>
          {r.options.length > 0 && (
            <ul>
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
          <p>
            <b>{r.type === 'written' ? 'Model answer' : 'Correct answer'}:</b>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{answerKey(r)}</span>
          </p>
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
