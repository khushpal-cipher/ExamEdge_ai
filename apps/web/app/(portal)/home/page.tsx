import Link from 'next/link';
import { formatTime, PHASE_LABEL, requestTime, testPhase } from '@/lib/assess';
import { requireMember } from '@/lib/tenant';

export default async function StudentHome() {
  const { institute, member, db } = await requireMember(['student']);
  // RLS returns only the student's own batches and the subjects/chapters of those batches (AC3.4).
  const [
    { data: me },
    { data: batches },
    { data: subjects },
    { data: tests },
    { data: attempts },
    { data: standings },
  ] = await Promise.all([
    db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle(),
    db.from('batches').select('name').eq('institute_id', institute.id).is('archived_at', null).order('name'),
    db
      .from('subjects')
      .select('id, name, batches(name), chapters(count)')
      .eq('institute_id', institute.id)
      .order('name'),
    // RLS: only scheduled or released tests of the student's batches.
    db
      .from('tests')
      .select('id, title, status, opens_at, closes_at')
      .eq('institute_id', institute.id)
      .in('status', ['scheduled', 'results_released'])
      .order('opens_at', { ascending: false })
      .limit(20),
    db.from('test_attempts').select('test_id, rank, status').eq('user_id', member.userId),
    db.from('batch_standings').select('overall_rank, average_percentage, batch_id').eq('user_id', member.userId),
  ]);
  const now = requestTime();
  const mine = new Map((attempts ?? []).map((a) => [a.test_id, a]));
  const upcoming = (tests ?? [])
    .filter((t) => ['upcoming', 'open'].includes(testPhase(t, now)))
    .sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const released = (tests ?? []).filter((t) => t.status === 'results_released');
  const lastRanked = released.find((t) => mine.get(t.id)?.rank);
  const first = me?.full_name?.split(' ')[0];
  return (
    <>
      <div className="top">
        <div>
          <h1>{first ? `Hello, ${first}` : 'Hello'}</h1>
          <p className="muted">{(batches ?? []).map((b) => b.name).join(' · ') || 'You are not in a batch yet.'}</p>
        </div>
      </div>
      <section className="card stack" aria-labelledby="my-subjects">
        <h2 id="my-subjects">My subjects</h2>
        {!subjects?.length ? (
          <p className="empty">No subjects yet. Your institute adds them to your batch.</p>
        ) : (
          <div className="grid">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card tile">
                <h3>{s.name}</h3>
                <p className="muted small">
                  {(s.batches as unknown as { name: string }).name} ·{' '}
                  {(s.chapters as unknown as { count: number }[])[0]?.count ?? 0} topics
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="grid">
        <section className="card stack" aria-labelledby="upcoming">
          <h2 id="upcoming">Upcoming tests</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No tests scheduled yet.</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {upcoming.map((t) => {
                const phase = testPhase(t, now);
                const started = mine.has(t.id);
                return (
                  <li key={t.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <b>{t.title}</b>
                      <span className="small muted">
                        {' '}
                        · {phase === 'open' ? `closes ${formatTime(t.closes_at)}` : formatTime(t.opens_at)}
                      </span>
                    </span>
                    {phase === 'open' ? (
                      <Link href={`/tests/${t.id}`} className="button primary">
                        {started ? 'Continue' : 'Start'}
                      </Link>
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
    </>
  );
}
