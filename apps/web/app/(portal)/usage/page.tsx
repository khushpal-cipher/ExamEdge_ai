import { MANAGERS, requireMember } from '@/lib/tenant';
import { FEATURE_LABEL, monthUsage } from '@/lib/usage';

// The institute's AI bill for this month in ₹ (ADR-041 part 2) plus the AI tokens used, in total and per feature
// (ADR-055, founder). Dollar costs stay hidden: only the ₹ charge is shown.
export default async function Bill() {
  const { institute, db } = await requireMember(MANAGERS);
  const [{ data: bill }, { data: q }, { data: globalOn }, { rows }] = await Promise.all([
    db.rpc('institute_bill', { inst: institute.id }).single<{ amount_inr: number | null }>(),
    db.from('institute_quotas').select('ai_enabled').eq('institute_id', institute.id).single(),
    db.rpc('ai_enabled'),
    monthUsage(db, institute.id),
  ]);
  const on = Boolean(globalOn && q?.ai_enabled);
  const amount = bill?.amount_inr;
  const tokens = (r: { input_tokens: number; output_tokens: number }) =>
    Number(r.input_tokens) + Number(r.output_tokens);
  const totalTokens = rows.reduce((s, r) => s + tokens(r), 0);
  const totalCalls = rows.reduce((s, r) => s + Number(r.calls), 0);
  const n = (v: number) => v.toLocaleString('en-IN');

  return (
    <>
      <div className="top">
        <div>
          <h1>Bill</h1>
          <p className="muted">This month (India time).</p>
        </div>
      </div>
      <div className="grid">
        <div className="card stat">
          <span className="muted small">This month&apos;s AI charge</span>
          <b>
            {amount == null
              ? 'Not available yet'
              : `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </b>
          <span className="muted small">
            {amount == null ? 'ExamEdge has not set the price yet.' : 'Updates as AI is used.'}
          </span>
        </div>
        <div className="card stat">
          <span className="muted small">AI used this month</span>
          <b>{n(totalTokens)} tokens</b>
          <span className="muted small">{n(totalCalls)} AI requests</span>
        </div>
        <div className="card stat">
          <span className="muted small">AI features</span>
          <b>
            <span className={`badge ${on ? 'good' : 'bad'}`}>{on ? 'On' : 'Off'}</span>
          </b>
          <span className="muted small">{on ? 'Working for your students' : 'Switched off by ExamEdge'}</span>
        </div>
      </div>
      <section className="card stack" aria-labelledby="by-feature">
        <h2 id="by-feature">Where the AI was used</h2>
        {rows.length === 0 ? (
          <p className="muted">No AI used yet this month.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Requests</th>
                <th scope="col">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td>{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                  <td>{n(Number(r.calls))}</td>
                  <td>{n(tokens(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export const metadata = { title: 'Bill' };
