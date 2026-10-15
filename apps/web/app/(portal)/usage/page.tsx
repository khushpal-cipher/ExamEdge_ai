import { MANAGERS, requireMember } from '@/lib/tenant';
import { budgetLevel, FEATURE_LABEL, monthUsage, usd } from '@/lib/usage';

const BANNER = {
  50: ['notice', 'Half of this month’s AI budget is used.'],
  80: ['alert', '80 % of this month’s AI budget is used.'],
  100: ['alert', 'This month’s AI budget is used up.'],
} as const;

export default async function Usage() {
  const { institute, db } = await requireMember(MANAGERS);
  const [{ rows, spent }, { data: q }, { data: globalOn }] = await Promise.all([
    monthUsage(db, institute.id),
    db
      .from('institute_quotas')
      .select('monthly_ai_budget_micro_usd, hard_stop, ai_enabled, student_daily_messages')
      .eq('institute_id', institute.id)
      .single(),
    db.rpc('ai_enabled'),
  ]);
  const budget = q?.monthly_ai_budget_micro_usd ?? 0;
  const level = budgetLevel(spent, budget);
  const banner = level ? BANNER[level] : null;
  const on = Boolean(globalOn && q?.ai_enabled);

  return (
    <>
      <div className="top">
        <div>
          <h1>AI usage</h1>
          <p className="muted">This month (India time). Limits are set by ExamEdge; ask us to change them.</p>
        </div>
      </div>
      {banner && (
        <p role="status" className={banner[0]}>
          {banner[1]} {q?.hard_stop && level === 100 && 'AI features are paused until next month.'}
        </p>
      )}
      <div className="grid">
        <div className="card stat">
          <span className="muted small">Spent this month</span>
          <b>{usd(spent)}</b>
          <span className="muted small">of {usd(budget)} budget</span>
        </div>
        <div className="card stat">
          <span className="muted small">AI features</span>
          <b>
            <span className={`badge ${on ? 'good' : 'bad'}`}>{on ? 'On' : 'Off'}</span>
          </b>
          <span className="muted small">
            {on ? `${q?.student_daily_messages ?? 0} doubts per student per day` : 'Switched off by ExamEdge'}
          </span>
        </div>
      </div>
      <section className="card stack" aria-labelledby="by-feature">
        <h2 id="by-feature">By feature</h2>
        {rows.length === 0 ? (
          <p className="empty">No AI use this month yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Uses</th>
                  <th>Blocked by limits</th>
                  <th>Tokens in / out</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature}>
                    <td>{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                    <td>{r.calls}</td>
                    <td>{r.blocked}</td>
                    <td>
                      {Number(r.input_tokens).toLocaleString('en-IN')} /{' '}
                      {Number(r.output_tokens).toLocaleString('en-IN')}
                    </td>
                    <td>{usd(Number(r.cost_micro_usd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">
          Demo mode uses a free stand-in AI, so costs show $0.00 until real AI keys are added.
        </p>
      </section>
    </>
  );
}
