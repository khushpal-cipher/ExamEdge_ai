import Link from 'next/link';
import { formatDuration, formatTime, pct, PHASE_LABEL, testPhase, toLocalInput, TYPE_SHORT } from '@/lib/assess';
import { MANAGERS, type requireMember } from '@/lib/tenant';
import {
  addTestQuestion,
  deleteTest,
  releaseResults,
  removeTestQuestion,
  setTestBatches,
  setTestStatus,
  updateTest,
  updateTestQuestion,
} from '../actions';
import { teachableBatches } from '../batches';
import { approveQuestion } from '../../questions/actions';
import { AiBadge } from '../../questions/ai-badge';

type Ctx = Awaited<ReturnType<typeof requireMember>>;
export type Test = {
  id: string;
  title: string;
  status: string;
  opens_at: string;
  closes_at: string;
  duration_seconds: number;
  shuffle_questions: boolean;
  created_by: string | null;
};
type TQ = {
  question_id: string;
  position: number;
  marks: number;
  negative_marks: number;
  questions: { stem: string; type: string; status: string; verification: string };
};

const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function StaffTest({ ctx, test }: { ctx: Ctx; test: Test }) {
  const { institute, member, db } = ctx;
  const phase = testPhase(test);
  const canManage = MANAGERS.includes(member.role) || test.created_by === member.userId;
  const [{ data: audience }, { data: tqs }, { data: attempts }, { data: written }] = await Promise.all([
    db.from('test_audience').select('batch_id, batches(name)').eq('test_id', test.id),
    db
      .from('test_questions')
      .select('question_id, position, marks, negative_marks, questions(stem, type, status, verification)')
      .eq('test_id', test.id)
      .order('position'),
    db
      .from('test_attempts')
      .select('id, user_id, status, score, max_score, rank, started_at, submitted_at')
      .eq('institute_id', institute.id)
      .eq('test_id', test.id)
      .order('rank', { nullsFirst: false }),
    db
      .from('attempt_answers')
      .select('marks_awarded, questions!inner(type), test_attempts!inner(test_id)')
      .eq('test_attempts.test_id', test.id)
      .eq('questions.type', 'written'),
  ]);
  const questions = (tqs ?? []) as unknown as TQ[];
  const batchIds = new Set((audience ?? []).map((a) => a.batch_id));
  const max = questions.reduce((s, q) => s + Number(q.marks), 0);
  const toCheck = written?.length ?? 0;
  const checked = (written ?? []).filter((w) => w.marks_awarded != null).length;
  const hasWritten = questions.some((q) => q.questions.type === 'written');

  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/tests">Tests</Link>
          </p>
          <h1>{test.title}</h1>
          <p className="muted">
            {formatTime(test.opens_at)} – {formatTime(test.closes_at)} · {formatDuration(test.duration_seconds)} ·{' '}
            {questions.length} questions · {max} marks
          </p>
          <p>
            <span className="badge">{PHASE_LABEL[phase]}</span>{' '}
            {(audience ?? []).map((a) => (a.batches as unknown as { name: string } | null)?.name).join(', ') ||
              'No batches yet'}
          </p>
        </div>
        {canManage && phase === 'draft' && (
          <form action={setTestStatus}>
            <input type="hidden" name="test_id" value={test.id} />
            <input type="hidden" name="status" value="scheduled" />
            <button type="submit" className="primary">
              Schedule
            </button>
          </form>
        )}
      </div>

      {canManage && (phase === 'draft' || phase === 'upcoming') && (
        <Settings
          test={test}
          batches={await teachableBatches(db, institute.id, member)}
          chosen={batchIds}
          draft={phase === 'draft'}
        />
      )}

      {(phase === 'open' || phase === 'upcoming') && (
        <section className="card stack" aria-labelledby="live">
          <h2 id="live">{phase === 'open' ? 'Test is open' : 'Scheduled'}</h2>
          <p>{attempts?.length ?? 0} students have started.</p>
          {canManage && (
            <div className="row">
              {phase === 'upcoming' && (attempts?.length ?? 0) === 0 && (
                <form action={setTestStatus}>
                  <input type="hidden" name="test_id" value={test.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit">Back to draft</button>
                </form>
              )}
              <form action={setTestStatus}>
                <input type="hidden" name="test_id" value={test.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button type="submit" className="link">
                  Cancel test
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {(phase === 'closed' || phase === 'released') && (
        <section className="card stack" aria-labelledby="checking">
          <h2 id="checking">{phase === 'closed' ? 'Checking and release' : 'Results'}</h2>
          {hasWritten && (
            <div className="stack">
              <p>
                Written answers:{' '}
                <b>
                  {checked} of {toCheck} checked
                </b>
              </p>
              <progress value={checked} max={Math.max(toCheck, 1)} aria-label="Written answers checked" />
              <p>
                <Link href={`/tests/${test.id}/check`} className="button">
                  {checked < toCheck ? 'Check answers' : 'Review or change marks'}
                </Link>
              </p>
            </div>
          )}
          <form action={releaseResults} className="row">
            <input type="hidden" name="test_id" value={test.id} />
            <button type="submit" className={phase === 'closed' ? 'primary' : ''} disabled={checked < toCheck}>
              {phase === 'closed' ? 'Release results' : 'Recalculate results'}
            </button>
            {phase === 'released' && (
              <span className="small muted">After fixing an answer key. Changing marks recalculates by itself.</span>
            )}
          </form>
        </section>
      )}

      {phase === 'released' && <Results test={test} attempts={attempts ?? []} ctx={ctx} />}

      <section className="card stack" aria-labelledby="questions">
        <h2 id="questions">Questions</h2>
        {questions.length === 0 ? (
          <p className="empty">No questions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Marks</th>
                  <th>Negative</th>
                  {phase === 'draft' && canManage && (
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.question_id}>
                    <td>{i + 1}</td>
                    <td>
                      <Link href={`/questions/${q.question_id}`}>{short(q.questions.stem)}</Link>
                      {q.questions.status === 'draft' && (
                        <div className="row small">
                          <AiBadge verification={q.questions.verification} />
                          {q.questions.verification === 'dual_solve_agree' && (
                            <form action={approveQuestion}>
                              <input type="hidden" name="question_id" value={q.question_id} />
                              <input type="hidden" name="back" value={`/tests/${test.id}`} />
                              <button type="submit" className="link" aria-label={`Approve question ${i + 1}`}>
                                Approve
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{TYPE_SHORT[q.questions.type]}</td>
                    {phase === 'draft' && canManage ? (
                      <>
                        <td colSpan={2}>
                          <form action={updateTestQuestion} className="row">
                            <input type="hidden" name="test_id" value={test.id} />
                            <input type="hidden" name="question_id" value={q.question_id} />
                            <input
                              name="marks"
                              type="number"
                              min={0.5}
                              step={0.5}
                              defaultValue={q.marks}
                              aria-label={`Marks for question ${i + 1}`}
                              style={{ width: 70 }}
                            />
                            <input
                              name="negative_marks"
                              type="number"
                              min={0}
                              step={0.25}
                              defaultValue={q.negative_marks}
                              aria-label={`Negative marks for question ${i + 1}`}
                              style={{ width: 70 }}
                            />
                            <button type="submit">Save</button>
                          </form>
                        </td>
                        <td>
                          <form action={removeTestQuestion}>
                            <input type="hidden" name="test_id" value={test.id} />
                            <input type="hidden" name="question_id" value={q.question_id} />
                            <button type="submit" className="link" aria-label={`Remove question ${i + 1}`}>
                              Remove
                            </button>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{q.marks}</td>
                        <td>{Number(q.negative_marks) ? `−${q.negative_marks}` : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {phase === 'draft' && canManage && (
          <AddQuestion ctx={ctx} test={test} have={new Set(questions.map((q) => q.question_id))} />
        )}
      </section>

      {canManage && phase === 'draft' && (
        <form action={deleteTest}>
          <input type="hidden" name="test_id" value={test.id} />
          <button type="submit" className="link">
            Delete this draft
          </button>
        </form>
      )}
    </>
  );
}

function Settings({
  test,
  batches,
  chosen,
  draft,
}: {
  test: Test;
  batches: { id: string; name: string }[];
  chosen: Set<string>;
  draft: boolean;
}) {
  return (
    <section className="card stack" aria-labelledby="settings">
      <h2 id="settings">Settings</h2>
      <form action={updateTest} className="stack">
        <input type="hidden" name="test_id" value={test.id} />
        <div className="inline">
          <label>
            Title
            <input name="title" required maxLength={200} defaultValue={test.title} />
          </label>
          <label>
            Opens (India time)
            <input name="opens_at" type="datetime-local" required defaultValue={toLocalInput(test.opens_at)} />
          </label>
          <label>
            Closes (India time)
            <input name="closes_at" type="datetime-local" required defaultValue={toLocalInput(test.closes_at)} />
          </label>
          <label>
            Duration (minutes)
            <input
              name="duration_minutes"
              type="number"
              min={1}
              max={1440}
              required
              defaultValue={test.duration_seconds / 60}
            />
          </label>
        </div>
        <label className="row" style={{ display: 'flex' }}>
          <input type="checkbox" name="shuffle" defaultChecked={test.shuffle_questions} /> Shuffle question order for
          each student
        </label>
        <div>
          <button type="submit">Save settings</button>
        </div>
      </form>
      {draft && (
        <form action={setTestBatches} className="stack">
          <input type="hidden" name="test_id" value={test.id} />
          <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted">Batches taking the test</legend>
            {batches.map((b) => (
              <label key={b.id} className="row" style={{ display: 'flex' }}>
                <input type="checkbox" name="batch_id" value={b.id} defaultChecked={chosen.has(b.id)} />
                {b.name}
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit">Save batches</button>
          </div>
        </form>
      )}
    </section>
  );
}

async function AddQuestion({ ctx, test, have }: { ctx: Ctx; test: Test; have: Set<string> }) {
  const { data: bank } = await ctx.db
    .from('questions')
    .select('id, type, stem, subjects(name), question_keys(question_id)')
    .eq('institute_id', ctx.institute.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  const usable = (bank ?? []).filter((q) => !have.has(q.id) && q.question_keys);
  return usable.length === 0 ? (
    <p className="muted small">
      No more questions with answer keys in the bank. <Link href="/questions">Add questions</Link>.
    </p>
  ) : (
    <form action={addTestQuestion} className="inline">
      <input type="hidden" name="test_id" value={test.id} />
      <label style={{ flex: 1 }}>
        Add from the bank
        <select name="question_id" required>
          {usable.map((q) => (
            <option key={q.id} value={q.id}>
              {(q.subjects as unknown as { name: string } | null)?.name} · {TYPE_SHORT[q.type]} · {short(q.stem, 70)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Marks
        <input name="marks" type="number" min={0.5} step={0.5} defaultValue={4} required style={{ width: 80 }} />
      </label>
      <label>
        Negative
        <input name="negative_marks" type="number" min={0} step={0.25} defaultValue={0} style={{ width: 80 }} />
      </label>
      <button type="submit" className="primary">
        Add question
      </button>
    </form>
  );
}

type Attempt = {
  id: string;
  user_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  rank: number | null;
  started_at: string;
  submitted_at: string | null;
};

async function Results({ test, attempts, ctx }: { test: Test; attempts: Attempt[]; ctx: Ctx }) {
  const { data: profiles } = await ctx.db.from('profiles').select('user_id, full_name');
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  return (
    <section className="card stack" aria-labelledby="rank-list">
      <div className="top">
        <h2 id="rank-list">Rank list ({attempts.length})</h2>
        <a href={`/tests/${test.id}/export`} className="button" download>
          Export CSV
        </a>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Score</th>
              <th>%</th>
              <th>Time taken</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{a.rank}</td>
                <td>
                  <Link href={`/students/${a.user_id}`}>{name.get(a.user_id) ?? 'Unnamed'}</Link>
                  {a.status === 'auto_submitted' && <span className="badge"> auto-submitted</span>}
                </td>
                <td>
                  {a.score} / {a.max_score}
                </td>
                <td>{pct(a.score, a.max_score)}</td>
                <td>
                  {a.submitted_at
                    ? formatDuration((Date.parse(a.submitted_at) - Date.parse(a.started_at)) / 1000)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
