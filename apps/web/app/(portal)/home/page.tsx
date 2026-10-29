import Link from 'next/link';
import { formatTime, PHASE_LABEL, requestTime, testPhase, TZ } from '@/lib/assess';
import { batchTests, studentBatches } from '@/lib/student';
import { DAILY_GOAL, isToday, level, streak, XP } from '@/lib/streak';
import { requireMember } from '@/lib/tenant';
import { RankScroller } from './rank-scroller';

// A 1-bit heart, one per step of the daily goal (retro student look)
const Heart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 7 6" width="21" height="18" shapeRendering="crispEdges" className={on ? 'on' : undefined}>
    <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
  </svg>
);

export default async function StudentHome() {
  const { institute, member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  const first = (
    await db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle()
  ).data?.full_name?.split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false }).format()) % 24;
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const title = <h1>{first ? `${greet}, ${first}` : greet}</h1>;
  if (!selected)
    return (
      <div className="top">
        <div>
          {title}
          <p>You are not in a batch yet.</p>
        </div>
      </div>
    );
  // RLS: only the student's own batches (current or past) and their subjects (AC3.4, ADR-040).
  // shortcut: reads every activity timestamp of this student; move to a SQL count per day once students have thousands.
  const [
    { data: subjects },
    tests,
    { data: attempts },
    { data: standings },
    { data: rankList },
    { data: doubts },
    { data: tools },
  ] = await Promise.all([
    db
      .from('subjects')
      .select('id, name, chapters(count)')
      .eq('institute_id', institute.id)
      .eq('batch_id', selected.id)
      .order('name'),
    batchTests(selected),
    db.from('test_attempts').select('test_id, rank, score, max_score, started_at').eq('user_id', member.userId),
    db
      .from('batch_standings')
      .select('overall_rank, average_percentage')
      .eq('user_id', member.userId)
      .eq('batch_id', selected.id)
      .maybeSingle(),
    db.rpc('batch_rank_list', { batch: selected.id }),
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
  const lastRanked = tests.find((t) => t.status === 'results_released' && mine.get(t.id)?.rank);
  const last = lastRanked && mine.get(lastRanked.id);
  const next = upcoming[0];
  const overall = standings?.overall_rank ? standings : null;
  const times = [
    ...(doubts ?? []).map((d) => d.created_at),
    ...(tools ?? []).map((t) => t.created_at),
    ...(attempts ?? []).map((a) => a.started_at),
  ];
  const days = streak(times, now);
  const xp = (doubts?.length ?? 0) * XP.doubt + (tools?.length ?? 0) * XP.tool + (attempts?.length ?? 0) * XP.test;
  const lv = level(xp);
  const today = Math.min(DAILY_GOAL, times.filter((t) => isToday(t, now)).length);
  const left = DAILY_GOAL - today;
  const go = next && testPhase(next, now) === 'open' && (mine.has(next.id) || !selected.leftAt) ? next : null;
  const weekday = (iso: string) =>
    new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long' }).format(new Date(iso));
  // Shown once when the page loads (no live ticking).
  const until = (iso: string) => {
    const m = Math.max(1, Math.round((Date.parse(iso) - now) / 60000));
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.floor(m / 60)} h`;
    const d = Math.floor(m / 1440);
    return `${d} day${d === 1 ? '' : 's'}`;
  };
  return (
    <>
      <div className="top">
        <div>
          {title}
          <p>
            {next
              ? `${upcoming.length} test${upcoming.length === 1 ? '' : 's'} coming up. ${next.title} ${testPhase(next, now) === 'open' ? 'is open now' : `opens ${weekday(next.opens_at)}`}.`
              : 'No tests scheduled. A good day to study.'}
            {selected.leftAt && ' Past batch: your own year, read-only for tests.'}
          </p>
        </div>
        <span className="badge">{selected.name}</span>
      </div>
      <section className="stats" aria-label="Your streak and points">
        <div className="stat">
          <span>Day streak</span>
          <b>{days}</b>
          <span className="small muted">{days ? 'keep it going' : `${left || DAILY_GOAL} tasks to start one`}</span>
        </div>
        <div className="stat">
          <span>XP</span>
          <b>{xp}</b>
          <span className="small muted">lifetime earned</span>
        </div>
        <div className="stat">
          <span>Level</span>
          <b>{lv.level}</b>
          <span className="meter" role="img" aria-label={`${lv.into} of ${lv.need} XP to level ${lv.level + 1}`}>
            <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
          </span>
        </div>
        <div className="stat">
          <span>Overall rank</span>
          {overall && Array.isArray(rankList) && rankList.length > 0 ? (
            <RankScroller rows={rankList as { rank: number; average: number; name: string; me: boolean }[]} />
          ) : (
            <>
              <b>—</b>
              <span className="small muted">after your first result</span>
            </>
          )}
        </div>
      </section>
      <section className="card goal" aria-labelledby="goal">
        <h2 id="goal">Today&apos;s goal</h2>
        <div className="goal-body">
          <div className="goal-count" role="img" aria-label={`${today} of ${DAILY_GOAL} done today`}>
            <b>
              {today}
              <span>/{DAILY_GOAL}</span>
            </b>
            <span className="hearts">
              {Array.from({ length: DAILY_GOAL }, (_, i) => (
                <Heart key={i} on={i < today} />
              ))}
            </span>
          </div>
          <div className="stack">
            <h3>{left ? 'One day at a time' : 'Daily goal done!'}</h3>
            <p className="muted">
              {!left
                ? 'Streak saved. Anything more is bonus XP.'
                : `Ask a doubt, use a study tool or take a test: ${left} more to ${days ? `keep your ${days}-day streak` : 'start a streak'}. Small steps, every day.`}
            </p>
          </div>
          {go ? (
            <Link href={`/tests/${go.id}`} className="button primary big">
              ▶ {mine.has(go.id) ? 'Continue' : 'Start'} {go.title}
            </Link>
          ) : subjects?.[0] ? (
            <Link href={`/subjects/${subjects[0].id}`} className="button primary big">
              ▶ Start studying
            </Link>
          ) : null}
        </div>
      </section>
      <div className="grid">
        <section className="card stack" aria-labelledby="upcoming">
          <h2 id="upcoming">Upcoming tests</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No tests scheduled yet.</p>
          ) : (
            <ul className="list rows">
              {upcoming.map((t) => {
                const phase = testPhase(t, now);
                const started = mine.has(t.id);
                return (
                  <li key={t.id} className="row between">
                    <span>
                      <b>{t.title}</b>
                      <span className="small muted">
                        {phase === 'open' ? `Closes ${formatTime(t.closes_at)}` : `Opens ${formatTime(t.opens_at)}`}
                      </span>
                    </span>
                    {phase === 'open' && (started || !selected.leftAt) ? (
                      <Link href={`/tests/${t.id}`} className="button primary">
                        {started ? 'Continue' : 'Start'}
                      </Link>
                    ) : phase === 'open' ? (
                      <span className="badge">Past batch</span>
                    ) : (
                      <span className="when" title={PHASE_LABEL[phase]}>
                        in {until(t.opens_at)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card stack" aria-labelledby="progress">
          <h2 id="progress">My progress</h2>
          {!last && !overall ? (
            <p className="empty">Your ranks and marks appear here after your first released test.</p>
          ) : (
            <ul className="list rows">
              {overall && (
                <li className="row between">
                  <span>
                    <b className="rank">#{overall.overall_rank}</b> Overall rank · {selected.name}
                  </span>
                  <b>{overall.average_percentage}%</b>
                </li>
              )}
              {last && (
                <li className="row between">
                  <span>
                    <b className="rank">#{last.rank}</b> Last test ·{' '}
                    <Link href={`/tests/${lastRanked.id}`}>{lastRanked.title}</Link>
                  </span>
                  {last.max_score ? <b>{Math.round((Number(last.score) / Number(last.max_score)) * 100)}%</b> : null}
                </li>
              )}
            </ul>
          )}
          <p>
            <Link href="/progress">See full progress →</Link>
          </p>
        </section>
      </div>
      <section className="stack" aria-labelledby="my-subjects">
        <h2 id="my-subjects" className="label">
          My subjects
        </h2>
        {!subjects?.length ? (
          <p className="empty">No subjects yet. Your institute adds them to your batch.</p>
        ) : (
          <div className="grid">
            {subjects.map((s) => {
              const n = (s.chapters as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <Link key={s.id} href={`/subjects/${s.id}`} className="card tile subject">
                  <span className="mark" aria-hidden="true">
                    {s.name.trim()[0]?.toUpperCase()}
                  </span>
                  <span>
                    <h3>{s.name}</h3>
                    <p className="muted small">
                      {n} topic{n === 1 ? '' : 's'}
                    </p>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export const metadata = { title: 'Home' };
