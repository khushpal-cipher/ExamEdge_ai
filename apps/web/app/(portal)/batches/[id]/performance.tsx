import Link from 'next/link';
import type { requireMember } from '@/lib/tenant';
import { Standings } from './standings';

type Ctx = Awaited<ReturnType<typeof requireMember>>;
type Perf = {
  students: number;
  active_week: number;
  tests_released: number;
  average: number | null;
  attention: number;
  trend: { title: string; takers: number; average: number | null }[];
  topics: { subject: string; chapter: string; percentage: number | null }[];
  people: { user_id: string; average: number; tests_counted: number; last_at: string | null; attention: boolean }[];
};

function Bar({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span aria-hidden="true" className="meter inline">
      <span style={{ width: `${v}%` }} />
    </span>
  );
}

// Batch Performance tab (Batch C2): whole-batch numbers from existing attempts (public.batch_performance), no AI cost.
export async function Performance({ ctx, batch, sort }: { ctx: Ctx; batch: string; sort?: string }) {
  const { data } = await ctx.db.rpc('batch_performance', { inst: ctx.institute.id, batch });
  const p = data as unknown as Perf | null;
  const { data: profiles } = await ctx.db.from('profiles').select('user_id, full_name');
  const name = new Map((profiles ?? []).map((x) => [x.user_id, x.full_name ?? 'Unnamed']));
  const scored = (p?.people ?? []).filter((x) => x.tests_counted > 0);
  const top = [...scored].sort((a, b) => b.average - a.average).slice(0, 5);
  const need = (p?.people ?? []).filter((x) => x.attention);
  const list = (rows: typeof top) => (
    <ul className="stack">
      {rows.map((x) => (
        <li key={x.user_id}>
          <Link href={`/students/${x.user_id}`}>{name.get(x.user_id) ?? 'Unnamed'}</Link>{' '}
          <span className="muted small">{x.tests_counted ? `${x.average}%` : 'no tests yet'}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {p && (
        <section className="card stack" aria-labelledby="numbers">
          <h2 id="numbers">This batch</h2>
          <dl className="stats">
            <div className="stat">
              <dt>Average score</dt>
              <dd>{p.average == null ? '—' : `${p.average}%`}</dd>
            </div>
            <div className="stat">
              <dt>Tests released</dt>
              <dd>{p.tests_released}</dd>
            </div>
            <div className="stat">
              <dt>Active this week</dt>
              <dd>
                {p.active_week} of {p.students}
              </dd>
            </div>
            <div className="stat">
              <dt>Need attention</dt>
              <dd>{p.attention}</dd>
            </div>
          </dl>
        </section>
      )}
      <Standings ctx={ctx} batch={batch} sort={sort} />
      {p && p.trend.length > 0 && (
        <section className="card stack" aria-labelledby="trend">
          <h2 id="trend">Test trend</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {p.trend.map((t, i) => (
                  <tr key={i}>
                    <td>{t.title}</td>
                    <td>
                      <Bar value={t.average} />
                    </td>
                    <td className="num">{t.average == null ? '—' : `${t.average}%`}</td>
                    <td className="num muted small">{t.takers} took it</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {p && p.topics.length > 0 && (
        <section className="card stack" aria-labelledby="weak">
          <h2 id="weak">Weakest topics</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {p.topics.slice(0, 8).map((t, i) => (
                  <tr key={i}>
                    <td>
                      {t.subject} · {t.chapter}
                    </td>
                    <td>
                      <Bar value={t.percentage} />
                    </td>
                    <td className="num">{t.percentage == null ? '—' : `${t.percentage}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {p && (top.length > 0 || need.length > 0) && (
        <section className="card stack" aria-labelledby="people">
          <h2 id="people">Students</h2>
          {need.length > 0 && (
            <>
              <h3>Need attention</h3>
              <p className="small muted">Average below 50% or no activity for 5 days.</p>
              {list(need)}
            </>
          )}
          {top.length > 0 && (
            <>
              <h3>Top students</h3>
              {list(top)}
            </>
          )}
        </section>
      )}
    </>
  );
}
