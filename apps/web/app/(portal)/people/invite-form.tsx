'use client';

import { useActionState } from 'react';
import { createInvitations, type InviteState } from '../actions';
import { CopyField, PromptHelp } from '../../copy-button';

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
            Name (optional)
            <input name="name" maxLength={120} placeholder="Riya Sharma" />
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
              One person per line: <code>email,name,role,batch name</code>. Name, role and batch are optional; role and
              batch default to the choices above. Leave the single email box empty when using a list.
            </p>
            <label>
              <span>
                Paste a list
                <PromptHelp batches={batches.map((b) => b.name)} />
              </span>
              <textarea name="csv" rows={5} placeholder={'riya@example.com,Riya Sharma,student,JEE 2027 Morning'} />
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
            Each person is emailed their link. If a row says &quot;not emailed&quot;, copy that link now and send it
            yourself — links are shown only once.
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
                    <td>
                      {r.email}{' '}
                      {r.link && (
                        <span className={`badge ${r.emailed ? 'good' : 'warn'}`}>
                          {r.emailed ? 'emailed' : 'not emailed'}
                        </span>
                      )}
                    </td>
                    <td>
                      {r.link ? (
                        <CopyField
                          value={r.link}
                          label={`Invitation link for ${r.email}`}
                          copyLabel={`Copy link for ${r.email}`}
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
