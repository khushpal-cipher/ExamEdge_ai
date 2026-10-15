'use client';

import { useEffect, useRef, useState } from 'react';
import { saveAnswer, submitAttempt } from '../actions';

export type RunnerQuestion = {
  question_id: string;
  pos: number;
  type: string;
  stem: string;
  options: { id: string; text: string }[];
  marks: number;
  negative_marks: number;
  response: unknown;
};
type State = 'saved' | 'saving' | 'error';

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const blank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// The deadline comes from the database; the browser clock is only used for the countdown, corrected by the
// difference to the server clock at page load. Saving after the deadline is refused by the database anyway.
export function Runner({
  testId,
  attemptId,
  deadline,
  serverNow,
  questions,
}: {
  testId: string;
  attemptId: string;
  deadline: string;
  serverNow: string;
  questions: RunnerQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(questions.map((q) => [q.question_id, q.response])),
  );
  const [state, setState] = useState<Record<string, State>>({});
  const [left, setLeft] = useState<number | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef(new Set<string>());
  const latest = useRef(answers);
  const ready = useRef(false);

  useEffect(() => {
    const offset = Date.parse(serverNow) - Date.now();
    const end = Date.parse(deadline);
    const tick = () => {
      const ms = end - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        form.current?.requestSubmit();
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [deadline, serverNow]);

  async function save(qid: string, value: unknown) {
    setState((s) => ({ ...s, [qid]: 'saving' }));
    const res = await saveAnswer(attemptId, qid, blank(value) ? null : value).catch(() => ({ ok: false }));
    setState((s) => ({ ...s, [qid]: res.ok ? 'saved' : 'error' }));
  }
  function change(qid: string, value: unknown, delay = 0) {
    latest.current = { ...latest.current, [qid]: value };
    setAnswers(latest.current);
    pending.current.add(qid);
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => {
      pending.current.delete(qid);
      void save(qid, value);
    }, delay);
  }

  const unanswered = questions.filter((q) => blank(answers[q.question_id])).length;
  return (
    <div className="stack">
      <div
        className="card row"
        role="timer"
        aria-live="off"
        style={{ justifyContent: 'space-between', position: 'sticky', top: 8 }}
      >
        <span>
          Time left: <b>{left == null ? '—' : clock(left)}</b>
        </span>
        <span className="small muted">
          {questions.length - unanswered} of {questions.length} answered · answers save automatically
        </span>
      </div>
      {questions.map((q, i) => {
        const value = answers[q.question_id];
        const st = state[q.question_id];
        const name = `q-${q.question_id}`;
        return (
          <fieldset key={q.question_id} className="card stack">
            <legend>
              <b>Question {i + 1}</b>{' '}
              <span className="small muted">
                {q.marks} marks{Number(q.negative_marks) ? `, −${q.negative_marks} if wrong` : ''}
                {q.type === 'multi' ? ' · more than one may be correct' : ''}
              </span>
            </legend>
            <p style={{ whiteSpace: 'pre-wrap' }}>{q.stem}</p>
            {(q.type === 'single' || q.type === 'multi') &&
              q.options.map((o) => {
                const chosen = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={o.id} className="row" style={{ display: 'flex' }}>
                    <input
                      type={q.type === 'single' ? 'radio' : 'checkbox'}
                      name={name}
                      checked={chosen.includes(o.id)}
                      onChange={(e) =>
                        change(
                          q.question_id,
                          q.type === 'single'
                            ? [o.id]
                            : e.target.checked
                              ? [...chosen, o.id]
                              : chosen.filter((c) => c !== o.id),
                        )
                      }
                    />
                    <span>
                      {o.id.toUpperCase()}. {o.text}
                    </span>
                  </label>
                );
              })}
            {q.type === 'numerical' && (
              <label>
                Your answer
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={value == null ? '' : String(value)}
                  onChange={(e) => change(q.question_id, e.target.value === '' ? null : Number(e.target.value), 600)}
                />
              </label>
            )}
            {q.type === 'written' && (
              <label>
                Your answer
                <textarea
                  rows={6}
                  maxLength={10000}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => change(q.question_id, e.target.value, 800)}
                />
              </label>
            )}
            <div className="row small">
              {(q.type === 'single' || q.type === 'multi') && !blank(value) && (
                <button type="button" className="link" onClick={() => change(q.question_id, [])}>
                  Clear answer
                </button>
              )}
              <span role="status" className={st === 'error' ? 'alert' : 'muted'}>
                {st === 'saving'
                  ? 'Saving…'
                  : st === 'saved'
                    ? 'Saved'
                    : st === 'error'
                      ? 'Not saved — check your internet'
                      : ''}
              </span>
              {st === 'error' && (
                <button type="button" onClick={() => save(q.question_id, answers[q.question_id])}>
                  Retry
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
      <form
        ref={form}
        action={submitAttempt}
        onSubmit={(e) => {
          if (ready.current) return;
          e.preventDefault();
          const auto = left != null && left <= 0;
          if (
            !auto &&
            !confirm(unanswered ? `${unanswered} questions are unanswered. Submit anyway?` : 'Submit the test?')
          )
            return;
          // Save anything still waiting for its autosave delay, then submit.
          const ids = [...pending.current];
          pending.current.clear();
          ids.forEach((id) => clearTimeout(timers.current[id]));
          void Promise.all(ids.map((id) => save(id, latest.current[id]))).finally(() => {
            ready.current = true;
            form.current?.requestSubmit();
          });
        }}
      >
        <input type="hidden" name="test_id" value={testId} />
        <input type="hidden" name="attempt_id" value={attemptId} />
        <button type="submit" className="primary">
          Submit test
        </button>
      </form>
    </div>
  );
}
