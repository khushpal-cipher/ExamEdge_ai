'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cbtWarning, saveAnswer, submitAttempt } from '../actions';
import { CBT_WARNINGS } from '@/lib/assess';
import { Markdown, MathText } from '@/lib/markdown';

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
// CBT (ADR-048): Google Chrome or a browser built on it, with the full-screen API (founder: students use Chrome).
// Safari, Firefox and iPhone browsers cannot keep the test in full screen, so they are refused.
export function cbtBrowserOk() {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return document.fullscreenEnabled && !!brands?.some((b) => b.brand === 'Google Chrome' || b.brand === 'Chromium');
}
const never = () => () => {};
// null while rendering on the server (unknown until the browser runs)
const useCbtBrowser = () => useSyncExternalStore(never, cbtBrowserOk, () => null);

// "Start test" of a CBT test: full screen is asked for in the click itself (browsers allow it only there).
export function CbtStart() {
  const ok = useCbtBrowser();
  if (ok === false)
    return (
      <p role="alert" className="alert">
        This test runs in full screen. Open it in Google Chrome on a computer or an Android phone.
      </p>
    );
  return (
    <button
      type="submit"
      className="primary"
      disabled={!ok}
      onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
    >
      Start test in full screen
    </button>
  );
}

const blank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// The deadline comes from the database; the browser clock is only used for the countdown, corrected by the
// difference to the server clock at page load. Saving after the deadline is refused by the database anyway.
export function Runner({
  testId,
  attemptId,
  deadline,
  serverNow,
  questions,
  cbt = false,
  warnings: initialWarnings = 0,
}: {
  testId: string;
  attemptId: string;
  deadline: string;
  serverNow: string;
  questions: RunnerQuestion[];
  cbt?: boolean;
  warnings?: number;
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
  const submitting = useRef(false);
  const router = useRouter();
  // CBT: `away` covers the questions until the page is in full screen again; one warning per time away.
  const [away, setAway] = useState(cbt);
  const [warnings, setWarnings] = useState(initialWarnings);
  const browserOk = useCbtBrowser() !== false;
  const leaving = useRef(false);
  const started = useRef(false);
  const [cur, setCur] = useState(0); // one question on screen at a time
  // Asked on the page, not with confirm(): Chrome leaves full screen for a browser popup (founder bug, session 40).
  const [confirming, setConfirming] = useState(false);

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

  useEffect(() => {
    if (!cbt) return;
    const key = `cbt-${attemptId}`;
    const ok = cbtBrowserOk();
    if (!started.current) {
      started.current = true; // React runs effects twice in development; count a reload only once
      // Back on this page after a reload or another page = the student left the test.
      if (sessionStorage.getItem(key)) leave();
      else {
        leaving.current = true; // nothing counts before the questions were first shown in full screen
        if (ok && document.fullscreenElement) void enter();
      }
    }
    const onFullscreen = () => !document.fullscreenElement && leave();
    const onVisibility = () => document.hidden && leave();
    // No copy or paste during a CBT test (founder, session 40): blocked, and each try is a warning.
    const onClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      leave();
    };
    const clip = ['copy', 'cut', 'paste'] as const;
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    clip.forEach((t) => document.addEventListener(t, onClipboard));
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', leave);
      clip.forEach((t) => document.removeEventListener(t, onClipboard));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per attempt; handlers read refs
  }, [cbt, attemptId]);

  async function enter() {
    if (!document.fullscreenElement) {
      const ok = await document.documentElement.requestFullscreen().then(
        () => true,
        () => false,
      );
      if (!ok) return;
    }
    sessionStorage.setItem(`cbt-${attemptId}`, '1');
    leaving.current = false;
    setAway(false);
  }
  function leave() {
    if (leaving.current || submitting.current) return;
    leaving.current = true;
    setAway(true);
    void warn();
  }
  // Pending answers are saved first: the 3rd warning submits the attempt in the database.
  async function warn() {
    await flush();
    const res = await cbtWarning(attemptId).catch(() => ({ count: null }));
    if (res.count != null && res.count < CBT_WARNINGS) return setWarnings(res.count);
    if (res.count != null) {
      submitting.current = true;
      sessionStorage.removeItem(`cbt-${attemptId}`);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
    router.refresh(); // submitted, or the attempt already ended (deadline): the page shows the result
  }
  function flush() {
    const ids = [...pending.current];
    pending.current.clear();
    ids.forEach((id) => clearTimeout(timers.current[id]));
    return Promise.all(ids.map((id) => save(id, latest.current[id])));
  }

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
    // A CBT test covers the whole page (no menu), so other pages of the portal cannot be opened during it.
    <div className={cbt ? 'stack cbt-run' : 'stack'}>
      {cbt && (away || !browserOk) && (
        <div className="cbt-cover" role="alertdialog" aria-modal="true" aria-labelledby="cbt-title">
          <div className="card stack">
            <h2 id="cbt-title">
              {!browserOk
                ? 'Open this test in Google Chrome'
                : warnings
                  ? `Warning ${warnings} of ${CBT_WARNINGS}`
                  : 'This test runs in full screen'}
            </h2>
            {!browserOk ? (
              <p>This test runs in full screen. Open it in Google Chrome on a computer or an Android phone.</p>
            ) : (
              <p>
                {warnings
                  ? 'You left full screen, switched to another tab or app, or tried to copy or paste. '
                  : 'Leaving full screen, switching to another tab or app, or copying or pasting counts as a warning. '}
                On warning {CBT_WARNINGS} your test is submitted automatically.
                {warnings === CBT_WARNINGS - 1 ? ' One more warning submits your test.' : ''}
              </p>
            )}
            {browserOk && (
              <div>
                <button type="button" className="primary" onClick={() => void enter()}>
                  {warnings ? 'Return to full screen' : 'Enter full screen'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="runbar" role="timer" aria-live="off">
        <div className="row between">
          <span>
            Time left: <b className="clock">{left == null ? '—' : clock(left)}</b>
          </span>
          <span className="small muted">
            {questions.length - unanswered} of {questions.length} answered · answers save automatically
          </span>
        </div>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${((questions.length - unanswered) / Math.max(questions.length, 1)) * 100}%` }} />
        </div>
      </div>
      {questions.slice(cur, cur + 1).map((q) => {
        const value = answers[q.question_id];
        const st = state[q.question_id];
        const name = `q-${q.question_id}`;
        return (
          <fieldset key={q.question_id} className="stack question-card">
            <legend>
              <b>Question {cur + 1}</b>{' '}
              <span className="small muted">
                {q.marks} marks{Number(q.negative_marks) ? `, −${q.negative_marks} if wrong` : ''}
                {q.type === 'multi' ? ' · more than one may be correct' : ''}
              </span>
            </legend>
            <div className="stem">
              <Markdown text={q.stem} />
            </div>
            {(q.type === 'single' || q.type === 'multi') &&
              q.options.map((o) => {
                const chosen = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={o.id} className="option">
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
                      {o.id.toUpperCase()}. <MathText text={o.text} />
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
      <div className="runnav">
        <button type="button" disabled={cur === 0} onClick={() => setCur(cur - 1)}>
          Previous
        </button>
        <span className="small muted">
          Question {cur + 1} of {questions.length}
        </span>
        <button type="button" disabled={cur === questions.length - 1} onClick={() => setCur(cur + 1)}>
          Next
        </button>
      </div>
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting.current) return;
          // Save anything still waiting for its autosave delay, then submit. Called directly: after preventDefault a
          // second requestSubmit() does not run a form `action` again.
          submitting.current = true;
          const data = new FormData(e.currentTarget);
          if (cbt) {
            sessionStorage.removeItem(`cbt-${attemptId}`);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          }
          void flush().finally(() => startTransition(() => submitAttempt(data)));
        }}
      >
        <input type="hidden" name="test_id" value={testId} />
        <input type="hidden" name="attempt_id" value={attemptId} />
        {confirming ? (
          <div className="card stack" role="alertdialog" aria-labelledby="submit-q">
            <p id="submit-q">
              {unanswered ? `${unanswered} questions are unanswered. Submit anyway?` : 'Submit the test?'}
            </p>
            <div className="row">
              <button type="submit" className="primary">
                Submit now
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Keep working
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="primary" onClick={() => setConfirming(true)}>
            Submit test
          </button>
        )}
      </form>
    </div>
  );
}
