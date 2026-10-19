import Link from 'next/link';
import { formatTime, requestTime, testPhase } from '@/lib/assess';
import { batchTests, studentBatches } from '@/lib/student';
import { requireMember } from '@/lib/tenant';

// Every institute test of the selected batch (ADR-040). Practice quizzes are generated_artifacts, never listed here.
export default async function Contests() {
  const { member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  if (!selected)
    return (
      <>
        <div className="top">
          <h1>Contest</h1>
        </div>
        <p className="empty">You are not in a batch yet.</p>
      </>
    );
  const [tests, { data: attempts }] = await Promise.all([
    batchTests(selected),
    db.from('test_attempts').select('test_id, status, score, max_score, rank').eq('user_id', member.userId),
  ]);
  const now = requestTime();
  const mine = new Map((attempts ?? []).map((a) => [a.test_id, a]));
  const by = (phase: string) => tests.filter((t) => testPhase(t, now) === phase);
  const live = by('open');
  const upcoming = by('upcoming').reverse(); // soonest first
  const waiting = by('closed');
  const results = by('released');
  const empty = !tests.length;
  return (
    <>
      <div className="top">
        <div>
          <h1>Contest</h1>
          <p className="muted">
            {selected.name}
            {selected.leftAt ? ' · past batch: results stay, new tests cannot be taken' : ''}
          </p>
        </div>
      </div>
      {empty && <p className="empty">No tests in this batch yet.</p>}
      {live.length > 0 && (
        <Section id="live" title="Live now">
          {live.map((t) => {
            const a = mine.get(t.id);
            return (
              <li key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  <b>{t.title}</b>
                  <span className="small muted"> · closes {formatTime(t.closes_at)}</span>
                </span>
                {a && a.status !== 'in_progress' ? (
                  <span className="badge">Submitted</span>
                ) : a || !selected.leftAt ? (
                  <Link href={`/tests/${t.id}`} className="button primary">
                    {a ? 'Continue' : 'Start'}
                  </Link>
                ) : (
                  <span className="badge">Past batch</span>
                )}
              </li>
            );
          })}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section id="upcoming" title="Upcoming">
          {upcoming.map((t) => (
            <li key={t.id}>
              <b>{t.title}</b>
              <span className="small muted"> · opens {formatTime(t.opens_at)}</span>
            </li>
          ))}
        </Section>
      )}
      {waiting.length > 0 && (
        <Section id="waiting" title="Finished · waiting for results">
          {waiting.map((t) => (
            <li key={t.id}>
              <Link href={`/tests/${t.id}`}>{t.title}</Link>
              <span className="small muted"> · {mine.has(t.id) ? 'submitted' : 'not taken'}</span>
            </li>
          ))}
        </Section>
      )}
      {results.length > 0 && (
        <Section id="results" title="Results">
          {results.map((t) => {
            const a = mine.get(t.id);
            return (
              <li key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                <Link href={`/tests/${t.id}`}>{t.title}</Link>
                <span className="small">
                  {a ? (
                    <>
                      <b>
                        {a.score ?? 0} / {a.max_score ?? '–'}
                      </b>
                      {a.rank ? ` · rank ${a.rank}` : ''}
                    </>
                  ) : (
                    <span className="muted">missed</span>
                  )}
                </span>
              </li>
            );
          })}
        </Section>
      )}
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card stack" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {children}
      </ul>
    </section>
  );
}

export const metadata = { title: 'Contest' };
