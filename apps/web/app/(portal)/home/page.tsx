import Link from 'next/link';
import { formatTime, PHASE_LABEL, requestTime, testPhase } from '@/lib/assess';
import { batchTests, studentBatches } from '@/lib/student';
import { requireMember } from '@/lib/tenant';

export default async function StudentHome() {
  const { institute, member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  const first = (
    await db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle()
  ).data?.full_name?.split(' ')[0];
  const hello = (
    <div>
      <h1>{first ? `Hello, ${first}` : 'Hello'}</h1>
      <p className="muted">
        {selected
          ? `${selected.name}${selected.leftAt ? ' · past batch: your own year, read-only for tests' : ''}`
          : 'You are not in a batch yet.'}
      </p>
    </div>
  );
  if (!selected) return <div className="top">{hello}</div>;
  // RLS: only the student's own batches (current or past) and their subjects (AC3.4, ADR-040).
  const [{ data: subjects }, tests, { data: attempts }, { data: standings }] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, chapters(count)')
      .eq('institute_id', institute.id)
      .eq('batch_id', selected.id)
      .order('name'),
    batchTests(selected),
    db.from('test_attempts').select('test_id, rank, status').eq('user_id', member.userId),
    db
      .from('batch_standings')
      .select('overall_rank, average_percentage, batch_id')
      .eq('user_id', member.userId)
      .eq('batch_id', selected.id),
  ]);
  const now = requestTime();
  const mine = new Map((attempts ?? []).map((a) => [a.test_id, a]));
  const upcoming = tests
    .filter((t) => ['upcoming', 'open'].includes(testPhase(t, now)))
    .sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const released = tests.filter((t) => t.status === 'results_released');
  const lastRanked = released.find((t) => mine.get(t.id)?.rank);
  const next = upcoming[0];
  const overall = standings?.find((s) => s.overall_rank);
  // Shown once when the page loads (no live ticking).
  const until = (iso: string) => {
    const m = Math.max(1, Math.round((Date.parse(iso) - now) / 60000));
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min`;
    const d = Math.floor(m / 1440);
    return `${d} day${d === 1 ? '' : 's'}`;
  };
  return (
    <>
      <div className="top">{hello}</div>
      <section className="hero" aria-label="At a glance">
        <div className="stat">
          <span>Next test</span>
          <b>{!next ? '—' : testPhase(next, now) === 'open' ? 'Open now' : `in ${until(next.opens_at)}`}</b>
          <span className="small">{next ? next.title : 'Nothing scheduled'}</span>
        </div>
        <div className="stat">
          <span>Overall rank</span>
          <b>{overall?.overall_rank ?? '—'}</b>
          <span className="small">
            {overall ? `average ${overall.average_percentage}%` : 'after your first result'}
          </span>
        </div>
        <div className="stat">
          <span>Last test rank</span>
          <b>{lastRanked ? mine.get(lastRanked.id)?.rank : '—'}</b>
          <span className="small">{lastRanked ? lastRanked.title : 'no results yet'}</span>
        </div>
      </section>
      <div className="grid">
        <section className="card stack" aria-labelledby="upcoming">
          <h2 id="upcoming">Upcoming tests</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No tests scheduled yet.</p>
          ) : (
            <ul className="stack list">
              {upcoming.map((t) => {
                const phase = testPhase(t, now);
                const started = mine.has(t.id);
                return (
                  <li key={t.id} className="row between">
                    <span>
                      <b>{t.title}</b>
                      <span className="small muted">
                        {' '}
                        · {phase === 'open' ? `closes ${formatTime(t.closes_at)}` : formatTime(t.opens_at)}
                      </span>
                    </span>
                    {phase === 'open' && (started || !selected.leftAt) ? (
                      <Link href={`/tests/${t.id}`} className="button primary">
                        {started ? 'Continue' : 'Start'}
                      </Link>
                    ) : phase === 'open' ? (
                      <span className="badge">Past batch</span>
                    ) : (
                      <span className="badge">{PHASE_LABEL[phase]}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card stack" aria-labelledby="progress">
          <h2 id="progress">My progress</h2>
          {!lastRanked && !standings?.some((s) => s.overall_rank) ? (
            <p className="empty">Your ranks and marks appear here after your first released test.</p>
          ) : (
            <>
              {lastRanked && (
                <p>
                  Last test rank: <b>{mine.get(lastRanked.id)?.rank}</b> in{' '}
                  <Link href={`/tests/${lastRanked.id}`}>{lastRanked.title}</Link>
                </p>
              )}
              {(standings ?? [])
                .filter((s) => s.overall_rank)
                .map((s) => (
                  <p key={s.batch_id}>
                    Overall rank: <b>{s.overall_rank}</b> · average {s.average_percentage}%
                  </p>
                ))}
            </>
          )}
          <p>
            <Link href="/progress">See full progress</Link>
          </p>
          {released.length > 0 && (
            <>
              <h3>Results</h3>
              <ul>
                {released.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tests/${t.id}`}>{t.title}</Link>
                    {!mine.has(t.id) && <span className="small muted"> · missed</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <section className="card stack" aria-labelledby="my-subjects">
        <h2 id="my-subjects">My subjects</h2>
        {!subjects?.length ? (
          <p className="empty">No subjects yet. Your institute adds them to your batch.</p>
        ) : (
          <div className="grid">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card tile">
                <span className="mark" aria-hidden="true">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <h3>{s.name}</h3>
                <p className="muted small">
                  {(s.chapters as unknown as { count: number }[])[0]?.count ?? 0} topic
                  {(s.chapters as unknown as { count: number }[])[0]?.count === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export const metadata = { title: 'Home' };
