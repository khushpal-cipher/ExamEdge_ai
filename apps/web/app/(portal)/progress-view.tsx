import Link from 'next/link';
import { formatDuration, formatTime, pct, TYPE_SHORT } from '@/lib/assess';

// Shape returned by private.student_progress (one function for teacher and student: AC7.9).
export type Progress = {
  standings: {
    batch: string;
    overall_rank: number | null;
    average_percentage: number;
    tests_counted: number;
    tests_missed: number;
    batch_size: number;
  }[];
  tests: {
    id: string;
    title: string;
    closes_at: string;
    max_marks: number;
    score: number | null;
    rank: number | null;
    takers: number;
    seconds: number | null;
    missed: boolean;
    objective: number | null;
    written: number | null;
    batch_average: number | null;
    highest: number | null;
  }[];
  chapters: { subject: string; chapter: string; marks: number; max_marks: number }[];
  types: { type: string; marks: number; max_marks: number; negative: number }[];
  subjects: { subject: string; percentage: number | null; batch_percentage: number | null }[];
  comments: { test: string; question: string; comment: string }[];
};

// Percentage per test over time: one series, one axis (0–100 %), markers with native hover titles. The same numbers
// are in the table below, so the chart is never the only way to read them.
function Trend({ tests }: { tests: Progress['tests'] }) {
  const points = tests.map((t) => ({
    label: t.title,
    value: t.missed ? 0 : (pct(t.score, t.max_marks) ?? 0),
    missed: t.missed,
  }));
  if (points.length < 2) return <p className="muted small">The trend appears after two released tests.</p>;
  const w = 600;
  const h = 180;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((100 - Math.max(0, Math.min(100, v))) * (h - pad.t - pad.b)) / 100;
  const first = points[0]!.value;
  const last = points.at(-1)!.value;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Percentage in each test, from ${first}% in the first to ${last}% in the latest`}
      style={{ width: '100%', height: 'auto', maxWidth: w }}
    >
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
            {g}%
          </text>
        </g>
      ))}
      <polyline
        points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={5} fill="var(--card)" stroke="var(--accent-ink)" strokeWidth={2}>
          <title>{`${p.label}: ${p.missed ? 'missed (0%)' : `${p.value}%`}`}</title>
        </circle>
      ))}
      <text x={x(points.length - 1)} y={y(last) - 10} textAnchor="end" fontSize={12} fill="var(--ink)">
        {last}%
      </text>
    </svg>
  );
}

function Bar({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span aria-hidden="true" className="meter inline">
      <span style={{ width: `${v}%` }} />
    </span>
  );
}

// Doubts asked per subject (private.tutor_activity): counts only, never the text of the chat (ADR-015).
export type Doubts = { subject: string; doubts: number; last_at: string }[];
// Practice quizzes per chapter (private.practice_activity); they never count for rank.
export type Practice = { subject: string; chapter: string; quizzes: number; average: number; last_at: string }[];

export function ProgressView({
  p,
  staff,
  doubts,
  practice,
}: {
  p: Progress;
  staff: boolean;
  doubts: Doubts;
  practice: Practice;
}) {
  const latest = p.tests.filter((t) => !t.missed).at(-1);
  return (
    <>
      <section aria-labelledby="summary" className="stack">
        <h2 id="summary">Summary</h2>
        {p.standings.length === 0 && <p className="empty">No released tests yet.</p>}
        {p.standings.map((s) => (
          <div key={s.batch} className="grid">
            <div className="card stat">
              <span className="muted small">Overall rank · {s.batch}</span>
              <b>{s.overall_rank ? `${s.overall_rank} of ${s.batch_size}` : '—'}</b>
            </div>
            <div className="card stat">
              <span className="muted small">Average percentage</span>
              <b>{s.tests_counted ? `${s.average_percentage}%` : '—'}</b>
            </div>
            <div className="card stat">
              <span className="muted small">Tests taken / missed</span>
              <b>
                {s.tests_counted - s.tests_missed} / {s.tests_missed}
              </b>
            </div>
            {latest && (
              <div className="card stat">
                <span className="muted small">Last test rank</span>
                <b>
                  {latest.rank} of {latest.takers}
                </b>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="trend">
        <h2 id="trend">Trend</h2>
        <Trend tests={p.tests} />
      </section>

      <section className="card stack" aria-labelledby="tests">
        <h2 id="tests">Institute tests</h2>
        {p.tests.length === 0 ? (
          <p className="empty">No released tests yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Marks</th>
                  <th>MCQ / numerical</th>
                  <th>Written</th>
                  <th>Test rank</th>
                  <th>Batch average</th>
                  <th>Highest</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {p.tests.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tests/${t.id}`}>{t.title}</Link>
                      <div className="small muted">{formatTime(t.closes_at)}</div>
                    </td>
                    {t.missed ? (
                      <td colSpan={7}>
                        <span className="badge bad">Missed (0%)</span>
                      </td>
                    ) : (
                      <>
                        <td>
                          {t.score} / {t.max_marks} ({pct(t.score, t.max_marks)}%)
                        </td>
                        <td>{t.objective ?? '—'}</td>
                        <td>{t.written ?? '—'}</td>
                        <td>
                          {t.rank} of {t.takers}
                        </td>
                        <td>{t.batch_average}</td>
                        <td>{t.highest}</td>
                        <td>{t.seconds != null ? formatDuration(t.seconds) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid">
        <section className="card stack" aria-labelledby="chapters">
          <h2 id="chapters">Topic strength</h2>
          {p.chapters.length === 0 ? (
            <p className="empty">Appears after the first released test.</p>
          ) : (
            <table>
              <tbody>
                {p.chapters.map((c) => {
                  const v = pct(c.marks, c.max_marks);
                  return (
                    <tr key={`${c.subject}-${c.chapter}`}>
                      <td>
                        {c.chapter}
                        <div className="small muted">{c.subject}</div>
                      </td>
                      <td>
                        <Bar value={v} /> {v ?? 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="card stack" aria-labelledby="types">
          <h2 id="types">Question types</h2>
          {p.types.length === 0 ? (
            <p className="empty">Appears after the first released test.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Lost to negative marks</th>
                </tr>
              </thead>
              <tbody>
                {p.types.map((t) => (
                  <tr key={t.type}>
                    <td>{TYPE_SHORT[t.type]}</td>
                    <td>{pct(t.marks, t.max_marks) ?? 0}%</td>
                    <td>{t.negative}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card stack" aria-labelledby="subjects">
        <h2 id="subjects">Compared with the batch</h2>
        {p.subjects.length === 0 ? (
          <p className="empty">Appears after the first released test.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>{staff ? 'Student' : 'You'}</th>
                <th>Batch average</th>
              </tr>
            </thead>
            <tbody>
              {p.subjects.map((s) => (
                <tr key={s.subject}>
                  <td>{s.subject}</td>
                  <td>{s.percentage ?? 0}%</td>
                  <td>{s.batch_percentage ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {p.comments.length > 0 && (
        <section className="card stack" aria-labelledby="comments">
          <h2 id="comments">Teacher comments</h2>
          <ul className="stack">
            {p.comments.map((c, i) => (
              <li key={i}>
                <b>{c.test}:</b> {c.comment}
                <div className="small muted">{c.question}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack" aria-labelledby="practice">
        <h2 id="practice">Self practice and study activity</h2>
        {doubts.length ? (
          <ul aria-label="Doubts asked to the AI tutor">
            {doubts.map((d) => (
              <li key={d.subject}>
                {d.subject}: {d.doubts} {d.doubts === 1 ? 'doubt' : 'doubts'} asked, last on {formatTime(d.last_at)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No doubts asked to the AI tutor yet.</p>
        )}
        {practice.length ? (
          <ul aria-label="Practice quizzes">
            {practice.map((q) => (
              <li key={`${q.subject}/${q.chapter}`}>
                {q.subject} · {q.chapter}: {q.quizzes} practice {q.quizzes === 1 ? 'quiz' : 'quizzes'}, average{' '}
                {Number(q.average).toFixed(0)}%, last on {formatTime(q.last_at)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No practice quizzes taken yet.</p>
        )}
        <p className="small muted">Practice quizzes help with learning. They never affect rank.</p>
      </section>
    </>
  );
}
