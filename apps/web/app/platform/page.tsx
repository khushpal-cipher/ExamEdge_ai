import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { rootHost } from '@/lib/tenant';
import { usd } from '@/lib/usage';
import { indiaDate } from '@/lib/pilot';
import { signOut } from '../actions';
import { approvePayment, rejectPayment, setGlobalAi, setGst } from './actions';
import { rupees, KIND_LABEL } from '@/lib/billing';
import { SignIn } from '../sign-in';
import { CreateInstitute } from './create-form';
import { Mfa } from './mfa';

export default async function Platform({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const db = await supabase();
  const { data: claims } = await db.auth.getClaims();
  const { error } = await searchParams;
  if (!claims?.claims.sub)
    return (
      <div className="center">
        <h1>ExamEdge platform admin</h1>
        <SignIn failed={error === 'signin'} />
      </div>
    );

  if (claims.claims.aal !== 'aal2') {
    const { data: factors } = await db.auth.mfa.listFactors();
    return (
      <div className="center">
        <h1>Two-factor sign-in</h1>
        {error === 'code' && (
          <p role="alert" className="alert">
            That code did not work. Try the next one.
          </p>
        )}
        <section className="card">
          <Mfa factorId={factors?.totp[0]?.id ?? null} />
        </section>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    );
  }

  // RLS: rows appear only for platform admins with an aal2 session.
  const [{ data: institutes }, { data: aiOn }, { data: usage }, { data: rate }, { data: gst }, { data: waiting }] =
    await Promise.all([
      db
        .from('institutes')
        .select('id, slug, name, status, pilot_end, created_at')
        .order('created_at', { ascending: false }),
      db.rpc('ai_enabled'),
      db.rpc('platform_usage'), // this India month, ADR-041
      db.rpc('inr_per_usd'),
      db.rpc('gst_number'),
      db
        .from('payments')
        .select('id, kind, total_paise, utr, created_at, institutes(name)')
        .eq('status', 'waiting')
        .not('utr', 'is', null)
        .order('created_at')
        .returns<
          {
            id: string;
            kind: string;
            total_paise: number;
            utr: string;
            created_at: string;
            institutes: { name: string } | null;
          }[]
        >(),
    ]);
  const used = new Map<string, string>(
    (usage ?? []).map(
      (u: { institute_id: string; input_tokens: number; output_tokens: number; cost_micro_usd: number }) => [
        u.institute_id,
        `${(Number(u.input_tokens) + Number(u.output_tokens)).toLocaleString('en-IN')} tokens · ${usd(Number(u.cost_micro_usd))}`,
      ],
    ),
  );
  const today = indiaDate();
  const deleteBy = indiaDate(new Date(), -30); // plan-review fix 10: ended pilot data is kept 30 days
  const oldPilots = (institutes ?? []).filter((i) => i.status === 'pilot' && i.pilot_end && i.pilot_end < deleteBy);
  return (
    <>
      <div className="top">
        <div>
          <h1>Institutes</h1>
          <p className="muted">Platform admins see institutes and quotas only — never students&apos; data.</p>
        </div>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>
      {error === 'ai' && (
        <p role="alert" className="alert">
          Could not change the AI switch. Sign in again and retry.
        </p>
      )}
      <section className="card stack" aria-labelledby="ai">
        <h2 id="ai">AI for all institutes</h2>
        <form action={setGlobalAi} className="row">
          <span className={`badge ${aiOn ? 'good' : 'bad'}`}>{aiOn ? 'AI is on' : 'AI is off everywhere'}</span>
          <input type="hidden" name="enabled" value={aiOn ? 'false' : 'true'} />
          <button type="submit" className={aiOn ? 'danger' : 'primary'}>
            {aiOn ? 'Turn AI off for everyone' : 'Turn AI back on'}
          </button>
        </form>
        <p className="small muted">Emergency switch: blocks every AI call of every institute from the next request.</p>
      </section>
      {(error === 'payment' || error === 'gst') && (
        <p role="alert" className="alert">
          Could not{' '}
          {error === 'gst'
            ? 'save the GST number (15 letters and digits)'
            : 'decide that payment (give a reason to reject)'}
          . Sign in again and retry.
        </p>
      )}
      <section className="card stack" aria-labelledby="pay">
        <h2 id="pay">Payments to check ({waiting?.length ?? 0})</h2>
        {!waiting?.length ? (
          <p className="muted">Nothing waiting.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Institute</th>
                <th scope="col">What</th>
                <th scope="col">Amount</th>
                <th scope="col">UTR</th>
                <th scope="col">Decide</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((p) => (
                <tr key={p.id}>
                  <td>{p.institutes?.name}</td>
                  <td>{KIND_LABEL[p.kind]}</td>
                  <td>{rupees(p.total_paise)}</td>
                  <td>{p.utr}</td>
                  <td>
                    <div className="stack">
                      <form action={approvePayment}>
                        <input type="hidden" name="pay" value={p.id} />
                        <button type="submit" className="primary">
                          Approve
                        </button>
                      </form>
                      <form action={rejectPayment} className="inline">
                        <input type="hidden" name="pay" value={p.id} />
                        <input name="reason" aria-label="Reason to reject" placeholder="Reason" required />
                        <button type="submit" className="danger">
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">
          Open your bank app first: approve only if a credit with this UTR and exactly this amount is there.
        </p>
        <form action={setGst} className="inline">
          <label>
            GST number
            <input name="gst" maxLength={15} defaultValue={gst ?? ''} />
          </label>
          <button type="submit">Save GST number</button>
        </form>
        <p className="small muted">
          {gst ? 'GST 18% is added to every new payment.' : 'Not set: no GST is added ("GST extra when applicable").'}
        </p>
      </section>
      <section className="card stack" aria-labelledby="bill">
        <h2 id="bill">Institute bills</h2>
        <p>
          ₹ per US$: <b>{rate ?? 'not set yet'}</b>
        </p>
        <p className="small muted">
          Each institute&apos;s Bill page shows this month&apos;s AI cost × this rate, in ₹. The rate updates itself
          every day.
          {rate == null && ' Not set yet: institutes see "Not available yet".'}
        </p>
      </section>
      <section className="card stack" aria-labelledby="new">
        <h2 id="new">New institute</h2>
        <CreateInstitute root={rootHost()} today={today} defaultEnd={indiaDate(new Date(), 7)} />
      </section>
      {oldPilots.length > 0 && (
        <section className="card stack" aria-labelledby="old-pilots">
          <h2 id="old-pilots">Ended pilots older than 30 days — delete by hand</h2>
          <p className="small muted">
            Their data is kept 30 days after the pilot ends. Export it if the coaching asks, then delete it (RUNBOOKS,
            offboarding).
          </p>
          <ul>
            {oldPilots.map((i) => (
              <li key={i.id}>
                <Link href={`/institutes/${i.id}`}>{i.name}</Link> — pilot ended {i.pilot_end}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card" aria-labelledby="list">
        <h2 id="list">All institutes ({institutes?.length ?? 0})</h2>
        {!institutes?.length ? (
          <p className="empty">No institutes visible. Only platform admins see institutes here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institute</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Pilot ends</th>
                  <th>Created</th>
                  <th>AI this month</th>
                </tr>
              </thead>
              <tbody>
                {institutes.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/institutes/${i.id}`}>{i.name}</Link>
                    </td>
                    <td>
                      {i.slug}.{rootHost()}
                    </td>
                    <td>
                      <span className={`badge ${i.status === 'suspended' ? 'bad' : 'good'}`}>{i.status}</span>
                    </td>
                    <td>
                      {i.status === 'pilot' && i.pilot_end
                        ? `${i.pilot_end}${i.pilot_end < today ? ' (ended)' : ''}`
                        : '—'}
                    </td>
                    <td>{new Date(i.created_at).toLocaleDateString('en-IN')}</td>
                    <td>{used.get(i.id) ?? '0 tokens · $0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
