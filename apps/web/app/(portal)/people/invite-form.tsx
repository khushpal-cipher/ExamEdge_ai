'use client';

import { useActionState } from 'react';
import { createInvitations, type InviteState } from '../actions';

type Batch = { id: string; name: string };

export function InviteForm({ roles, batches }: { roles: string[]; batches: Batch[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvitations, null);
  return (
    <div className="stack">
      <form action={action} className="stack">
        <div className="inline">
          <label>
            Email
            <input name="email" type="email" maxLength={254} placeholder="riya@example.com" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="student">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Batch
            <select name="batch_id" defaultValue="">
              <option value="">No batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details>
          <summary>Invite many at once (CSV)</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <p className="small muted">
              One person per line: <code>email,role,batch name</code>. Role and batch are optional and default to the
              choices above. Leave the single email box empty when using a list.
            </p>
            <label>
              Paste a list
              <textarea name="csv" rows={5} placeholder={'riya@example.com,student,JEE 2027 Morning'} />
            </label>
            <label>
              Or choose a .csv file
              <input name="file" type="file" accept=".csv,text/csv,text/plain" />
            </label>
          </div>
        </details>
        <div>
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create invitations'}
          </button>
        </div>
      </form>
      {state && (
        <div role="status" className="stack">
          <p className="small">
            Email sending is not set up yet. Copy each link now and send it yourself — it is shown only once.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Invitation link or problem</th>
                </tr>
              </thead>
              <tbody>
                {state.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.email}</td>
                    <td>
                      {r.link ? (
                        <input
                          readOnly
                          value={r.link}
                          aria-label={`Invitation link for ${r.email}`}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <span className="badge bad">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
