import { isFresh, KIND_LABEL, rupees, upiLink } from '@/lib/billing';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { FEATURE_LABEL, monthUsage } from '@/lib/usage';
import { Flash, type Search } from '../flash';
import { startPay, submitUtr } from './actions';

type Quote = { kind: string; accounts: number | null; base_paise: number; gst_paise: number; total_paise: number };
type Pay = {
  id: string;
  kind: string;
  total_paise: number;
  utr: string | null;
  status: string;
  reject_reason: string | null;
  receipt_no: string | null;
  created_at: string;
};
const STATUS_BADGE: Record<string, string> = { waiting: 'warn', approved: 'good', rejected: 'bad' };

// The institute's AI bill for this month in ₹ (ADR-041 part 2) plus the AI tokens used, in total and per feature
// (ADR-055, founder). Dollar costs stay hidden: only the ₹ charge is shown.
export default async function Bill({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(MANAGERS);
  const owner = member.role === 'owner';
  const quote = async (kind: string) =>
    ((await db.rpc('bill_quote', { inst: institute.id, pay_kind: kind })).data as Quote[] | null)?.[0] ?? null;
  const [{ data: st }, monthly, yearly, extras, topup, { data: pays }] = await Promise.all([
    db.rpc('billing_status', { inst: institute.id }).single<{
      status: string;
      pilot_end: string | null;
      paid_until: string | null;
      billing_plan: string | null;
      accounts: number;
      read_only: boolean;
      ai_used_micro: number;
      ai_budget_micro: number;
    }>(),
    quote('monthly'),
    quote('yearly'),
    quote('extras'),
    quote('topup'),
    db
      .from('payments')
      .select('id, kind, total_paise, utr, status, reject_reason, receipt_no, created_at')
      .eq('institute_id', institute.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<Pay[]>(),
  ]);
  const aiPct =
    st && Number(st.ai_budget_micro) > 0
      ? Math.round((Number(st.ai_used_micro) / Number(st.ai_budget_micro)) * 100)
      : 0;
  // started, UTR not typed yet, less than 24 hours old
  const open = (pays ?? []).find((p) => p.status === 'waiting' && !p.utr && isFresh(p.created_at));
  const shown = (pays ?? []).filter((p) => p.utr || p.status !== 'waiting'); // a payment only started is not listed
  const checking = (pays ?? []).some((p) => p.status === 'waiting' && p.utr);
  const upiId = process.env.UPI_ID;
  const saving = monthly && yearly ? Number(monthly.base_paise) * 12 - Number(yearly.base_paise) : 0;
  const offers = [monthly, yearly, extras, topup].filter((o): o is Quote => !!o);
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
      <Flash searchParams={searchParams} />
      {st?.read_only && (
        <p role="alert" className="alert">
          A payment is due, so nothing can be changed and AI is off. Pay below to continue; access returns when ExamEdge
          approves the payment.
        </p>
      )}
      {st && aiPct >= 80 && !st.read_only && (
        <p role="alert" className="alert">
          {aiPct}% of this period&apos;s AI budget is used.
          {st.status === 'active'
            ? ' Buy a top-up before it runs out.'
            : ' When it is used up, AI stops until the pilot ends.'}
        </p>
      )}
      <section className="card stack" aria-labelledby="plan">
        <h2 id="plan">Your plan</h2>
        <section className="stats three" aria-label="Plan">
          <div className="stat">
            <span>Accounts</span>
            <b>{st?.accounts ?? '—'}</b>
            <span className="muted small">Students, teachers and admins. The owner is free.</span>
          </div>
          <div className="stat">
            <span>{st?.status === 'pilot' ? 'Free pilot ends' : 'Paid until'}</span>
            <b>{(st?.status === 'pilot' ? st.pilot_end : st?.paid_until) ?? '—'}</b>
            <span className="muted small">
              {st?.paid_until &&
                `Next bill from ${new Date(Date.parse(st.paid_until) + 86_400_000).toISOString().slice(0, 10)}.`}
            </span>
          </div>
          <div className="stat">
            <span>AI budget used</span>
            <b>{aiPct}%</b>
            <span className="muted small">{st?.status === 'pilot' ? 'For the whole pilot.' : 'This month.'}</span>
          </div>
        </section>
        {offers.length === 0 ? (
          <p className="muted">Nothing to pay right now. Renewal opens 7 days before your paid period ends.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Accounts</th>
                <th scope="col">Amount</th>
                {owner && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.kind}>
                  <td>
                    {KIND_LABEL[o.kind]}
                    {o.kind === 'yearly' && saving > 0 && <small className="muted"> · save {rupees(saving)}</small>}
                  </td>
                  <td>{o.accounts ?? '—'}</td>
                  <td>
                    {rupees(o.total_paise)}
                    {Number(o.gst_paise) > 0 && <small className="muted"> incl. GST</small>}
                  </td>
                  {owner && (
                    <td>
                      <form action={startPay}>
                        <input type="hidden" name="kind" value={o.kind} />
                        <button type="submit" disabled={checking}>
                          Pay
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {owner && open && (
          <div className="card stack" role="group" aria-label="Pay by UPI">
            <h3>
              Pay {rupees(open.total_paise)} by UPI — {KIND_LABEL[open.kind]}
            </h3>
            {upiId ? (
              <p>
                UPI id: <b>{upiId}</b> ·{' '}
                <a href={upiLink(upiId, open.total_paise, `ExamEdge ${institute.slug}`)}>Pay with UPI</a>
              </p>
            ) : (
              <p className="muted">Write to support@examedgeai.in for the UPI id.</p>
            )}
            <form action={submitUtr} className="inline">
              <input type="hidden" name="pay" value={open.id} />
              <label>
                UTR (12 digits, shown by your UPI app after paying)
                <input name="utr" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} required />
              </label>
              <button type="submit" className="primary">
                I have paid
              </button>
            </form>
          </div>
        )}
        <p className="small muted">
          Monthly is billed on the highest number of accounts you had in the month. On a yearly plan, accounts added
          during the year are billed each month for the months left in the year; pay within 7 days or the app becomes
          read-only. An amount is valid for 24 hours. GST extra when applicable. No refunds; you can stop any time and
          keep access until the paid period ends.
          {!owner && ' Only the owner can pay.'}
        </p>
        {checking && (
          <p role="status" className="notice">
            Your payment is waiting to be checked. Access continues as it is until ExamEdge approves it.
          </p>
        )}
      </section>
      {shown.length > 0 && (
        <section className="card stack" aria-labelledby="payments">
          <h2 id="payments">Payments</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">What</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>{p.created_at.slice(0, 10)}</td>
                  <td>{KIND_LABEL[p.kind]}</td>
                  <td>{rupees(p.total_paise)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                    {p.reject_reason && <small className="muted"> {p.reject_reason}</small>}
                  </td>
                  <td>{p.receipt_no ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="stats three" aria-label="This month">
        <div className="stat">
          <span>This month&apos;s AI charge</span>
          <b>
            {amount == null
              ? '—'
              : `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </b>
          <span className="muted small">
            {amount == null ? 'Not available yet: ExamEdge has not set the price.' : 'Updates as AI is used.'}
          </span>
        </div>
        <div className="stat">
          <span>AI used this month</span>
          <b>
            {n(totalTokens)} <small>tokens</small>
          </b>
          <span className="muted small">{n(totalCalls)} AI requests</span>
        </div>
        <div className="stat">
          <span>AI features</span>
          <b>
            <span className={`badge ${on ? 'good' : 'bad'}`}>{on ? 'On' : 'Off'}</span>
          </b>
          <span className="muted small">{on ? 'Working for your students' : 'Switched off by ExamEdge'}</span>
        </div>
      </section>
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
