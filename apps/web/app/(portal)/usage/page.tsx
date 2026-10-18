import { MANAGERS, requireMember } from '@/lib/tenant';

// The institute's AI bill for this month in ₹ (ADR-041 part 2): no tokens or per-feature cost, only what to pay.
export default async function Bill() {
  const { institute, db } = await requireMember(MANAGERS);
  const [{ data: bill }, { data: q }, { data: globalOn }] = await Promise.all([
    db.rpc('institute_bill', { inst: institute.id }).single<{ amount_inr: number | null }>(),
    db.from('institute_quotas').select('ai_enabled').eq('institute_id', institute.id).single(),
    db.rpc('ai_enabled'),
  ]);
  const on = Boolean(globalOn && q?.ai_enabled);
  const amount = bill?.amount_inr;

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
          <span className="muted small">AI features</span>
          <b>
            <span className={`badge ${on ? 'good' : 'bad'}`}>{on ? 'On' : 'Off'}</span>
          </b>
          <span className="muted small">{on ? 'Working for your students' : 'Switched off by ExamEdge'}</span>
        </div>
      </div>
    </>
  );
}
