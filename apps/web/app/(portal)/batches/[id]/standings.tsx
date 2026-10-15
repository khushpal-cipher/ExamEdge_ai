import Link from 'next/link';
import type { requireMember } from '@/lib/tenant';
import { pct } from '@/lib/assess';

type Ctx = Awaited<ReturnType<typeof requireMember>>;
export type StandingRow = {
  user_id: string;
  name: string;
  overall_rank: number | null;
  average_percentage: number;
  tests_counted: number;
  tests_missed: number;
  last: number | null;
};

const SORTS: Record<string, [string, (a: StandingRow, b: StandingRow) => number]> = {
  rank: ['Overall rank', (a, b) => (a.overall_rank ?? 1e9) - (b.overall_rank ?? 1e9) || a.name.localeCompare(b.name)],
  name: ['Name', (a, b) => a.name.localeCompare(b.name)],
  missed: ['Tests missed', (a, b) => b.tests_missed - a.tests_missed || a.name.localeCompare(b.name)],
  last: ['Last test', (a, b) => (b.last ?? -1e9) - (a.last ?? -1e9) || a.name.localeCompare(b.name)],
};

// Batch view (HOW_IT_WORKS 2E): every student with overall rank, average %, last test score and tests missed.
// Shared with the CSV export so the file matches the screen.
export async function standingRows(db: Ctx['db'], batch: string) {
  const [{ data: standings }, { data: last }, { data: profiles }] = await Promise.all([
    db
      .from('batch_standings')
      .select('user_id, overall_rank, average_percentage, tests_counted, tests_missed')
      .eq('batch_id', batch),
    db
      .from('tests')
      .select('id, title, test_audience!inner(batch_id), test_attempts(user_id, score, max_score)')
      .eq('test_audience.batch_id', batch)
      .eq('status', 'results_released')
      .order('closes_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('profiles').select('user_id, full_name'),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  const lastScore = new Map(
    ((last?.test_attempts ?? []) as { user_id: string; score: number; max_score: number }[]).map((a) => [
      a.user_id,
      pct(a.score, a.max_score),
    ]),
  );
  const rows: StandingRow[] = (standings ?? []).map((s) => ({
    ...s,
    name: name.get(s.user_id) ?? 'Unnamed',
    last: lastScore.get(s.user_id) ?? null,
  }));
  return { rows, lastTitle: last?.title as string | undefined };
}

export async function Standings({ ctx, batch, sort }: { ctx: Ctx; batch: string; sort?: string }) {
  const { rows, lastTitle } = await standingRows(ctx.db, batch);
  const key = sort && SORTS[sort] ? sort : 'rank';
  rows.sort(SORTS[key]![1]);
  return (
    <section className="card stack" aria-labelledby="standings">
      <div className="top">
        <h2 id="standings">Rank list</h2>
        {rows.length > 0 && (
          <a href={`/batches/${batch}/export`} className="button" download>
            Export CSV
          </a>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="empty">Ranks appear after the first test of this batch is released.</p>
      ) : (
        <>
          <nav aria-label="Sort rank list" className="row small">
            Sort by:
            {Object.entries(SORTS).map(([k, [label]]) => (
              <Link key={k} href={`/batches/${batch}?sort=${k}`} aria-current={k === key ? 'true' : undefined}>
                {k === key ? <b>{label}</b> : label}
              </Link>
            ))}
          </nav>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Overall rank</th>
                  <th>Student</th>
                  <th>Average %</th>
                  <th>Last test{lastTitle ? ` (${lastTitle})` : ''}</th>
                  <th>Tests missed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td>{r.overall_rank ?? '—'}</td>
                    <td>
                      <Link href={`/students/${r.user_id}`}>{r.name}</Link>
                    </td>
                    <td>{r.tests_counted ? r.average_percentage : '—'}</td>
                    <td>{r.last == null ? '—' : `${r.last}%`}</td>
                    <td>{r.tests_missed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
