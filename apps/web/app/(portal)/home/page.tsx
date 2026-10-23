import Link from 'next/link';
import { formatTime, PHASE_LABEL, requestTime, testPhase, TZ } from '@/lib/assess';
import { batchTests, studentBatches } from '@/lib/student';
import { DAILY_GOAL, isToday, level, streak, week, XP } from '@/lib/streak';
import { requireMember } from '@/lib/tenant';

export default async function StudentHome() {
  const { institute, member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  const first = (
    await db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle()
  ).data?.full_name?.split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false }).format()) % 24;
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const hello = (
    <div>
      <h1>{first ? `${greet}, ${first}` : greet}</h1>
      <p className="muted">
        {selected
          ? `${selected.name}${selected.leftAt ? ' · past batch: your own year, read-only for tests' : ''}`
          : 'You are not in a batch yet.'}
      </p>
    </div>
  );
  if (!selected) return <div className="top">{hello}</div>;
  // RLS: only the student's own batches (current or past) and their subjects (AC3.4, ADR-040).
  // shortcut: reads every activity timestamp of this student; move to a SQL count per day once students have thousands.
  const [{ data: subjects }, tests, { data: attempts }, { data: standings }, { data: doubts }, { data: tools }] =
    await Promise.all([
      db
        .from('subjects')
        .select('id, name, chapters(count)')
        .eq('institute_id', institute.id)
        .eq('batch_id', selected.id)
        .order('name'),
      batchTests(selected),
      db.from('test_attempts').select('test_id, rank, status, started_at').eq('user_id', member.userId),
      db
        .from('batch_standings')
        .select('overall_rank, average_percentage, batch_id')
        .eq('user_id', member.userId)
        .eq('batch_id', selected.id),
      // RLS: only the student's own conversations' messages and own study tools.
      db.from('messages').select('created_at').eq('institute_id', institute.id).eq('role', 'user'),
      db
        .from('generated_artifacts')
        .select('created_at')
        .eq('institute_id', institute.id)
        .eq('owner_user_id', member.userId),
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
  const times = [
    ...(doubts ?? []).map((d) => d.created_at),
    ...(tools ?? []).map((t) => t.created_at),
    ...(attempts ?? []).map((a) => a.started_at),
  ];
  const days = streak(times, now);
  const xp = (doubts?.length ?? 0) * XP.doubt + (tools?.length ?? 0) * XP.tool + (attempts?.length ?? 0) * XP.test;
  const lv = level(xp);
  const today = Math.min(DAILY_GOAL, times.filter((t) => isToday(t, now)).length);
  const go = next && testPhase(next, now) === 'open' && (mine.has(next.id) || !selected.leftAt) ? next : null;
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
      <section className="hud" aria-label="Your streak and points">
        <div className={`hud-item flame${days ? '' : ' cold'}`}>
          <span aria-hidden="true">🔥</span>
          <b>{days}</b>
          <span>day streak</span>
        </div>
        <div className="hud-item gem">
          <span aria-hidden="true">⚡</span>
          <b>{xp}</b>
          <span>XP</span>
        </div>
        <div className="hud-item lvl">
          <span aria-hidden="true">🏆</span>
          <b>Level {lv.level}</b>
          <span className="meter" aria-label={`${lv.into} of ${lv.need} XP to level ${lv.level + 1}`}>
            <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
          </span>
        </div>
      </section>
      <section className="quest" aria-labelledby="goal">
        <div
          className="ring"
          style={{ '--p': `${(today / DAILY_GOAL) * 100}%` } as React.CSSProperties}
          role="img"
          aria-label={`${today} of ${DAILY_GOAL} done today`}
        >
          <b>
            {today}/{DAILY_GOAL}
          </b>
        </div>
        <div className="stack">
          <h2 id="goal">{today >= DAILY_GOAL ? 'Daily goal done! 🎉' : "Today's goal"}</h2>
          <p className="muted">
            {today >= DAILY_GOAL
              ? 'Streak saved. Anything more is bonus XP.'
              : days
                ? `Do ${DAILY_GOAL - today} more: ask a doubt, use a study tool or take a test. Keep your ${days}-day streak alive!`
                : `Ask a doubt, use a study tool or take a test (${DAILY_GOAL - today} to go) to start a streak.`}
          </p>
          <ol className="week" aria-label="Last 7 days">
            {week(times, now).map((d, i) => (
              <li key={i} className={`${d.active ? 'on' : ''}${d.today ? ' today' : ''}`}>
                <span aria-hidden="true">{d.active ? '🔥' : ''}</span>
                <small>{d.label}</small>
                <span className="sr-only">{d.active ? 'studied' : 'missed'}</span>
              </li>
            ))}
          </ol>
          {go ? (
            <Link href={`/tests/${go.id}`} className="button primary big">
              {mine.has(go.id) ? 'Continue' : 'Start'} {go.title} · +{XP.test} XP
            </Link>
          ) : subjects?.[0] ? (
            <Link href={`/subjects/${subjects[0].id}`} className="button primary big">
              Start studying
            </Link>
          ) : null}
        </div>
      </section>
      <p className="ticker" aria-hidden="true">
        {[0, 1].map((i) => (
          <span key={i}>
            {`✦ ${days ? `${days} day streak` : 'start a streak today'} ✦ ${xp} XP ✦ level ${lv.level} ✦ one doubt a day keeps the rank up ✦ ${DAILY_GOAL - today > 0 ? `${DAILY_GOAL - today} to go today` : 'daily goal done'} `.repeat(
              2,
            )}
          </span>
        ))}
      </p>
      {(next || overall || lastRanked) && (
        <section className="hero" aria-label="At a glance">
          <div className="stat">
            <span>Next test</span>
            <b>{!next ? '—' : testPhase(next, now) === 'open' ? 'Open now' : `in ${until(next.opens_at)}`}</b>
            <span className="small">{next ? next.title : 'Nothing scheduled'}</span>
          </div>
          <div className="stat">
            <span>Overall rank</span>
            <b>{overall?.overall_rank ? `#${overall.overall_rank}` : '—'}</b>
            <span className="small">
              {overall ? `average ${overall.average_percentage}%` : 'after your first result'}
            </span>
          </div>
          <div className="stat">
            <span>Last test rank</span>
            <b>{lastRanked ? `#${mine.get(lastRanked.id)?.rank}` : '—'}</b>
            <span className="small">{lastRanked ? lastRanked.title : 'no results yet'}</span>
          </div>
        </section>
      )}
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
            {subjects.map((s, i) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className={`card tile subject c${i % 5}`}>
                <span className="mark" aria-hidden="true">
                  {EMOJI.find(([re]) => re.test(s.name))?.[1] ?? '📘'}
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

const EMOJI: [RegExp, string][] = [
  [/phys/i, '⚛️'],
  [/chem/i, '🧪'],
  [/math/i, '📐'],
  [/bio|bot|zoo/i, '🧬'],
  [/eng/i, '📖'],
];

export const metadata = { title: 'Home' };
