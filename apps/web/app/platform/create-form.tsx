'use client';

import { useActionState } from 'react';
import { createInstitute, type CreateState } from './actions';

export function CreateInstitute({ root }: { root: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createInstitute, null);
  return (
    <form action={action} className="stack">
      <div className="inline">
        <label>
          Institute name
          <input name="name" required maxLength={120} placeholder="Sharma Classes" />
        </label>
        <label>
          Web address (subdomain)
          <input name="slug" required pattern="[a-z0-9-]{3,40}" placeholder="sharma" />
        </label>
        <label>
          Owner email
          <input name="owner_email" type="email" required maxLength={254} />
        </label>
        <button type="submit" className="primary" disabled={pending}>
          Create institute
        </button>
      </div>
      <p className="small muted">The address becomes &lt;subdomain&gt;.{root}.</p>
      {state && 'error' in state && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      {state && 'link' in state && (
        <div role="status" className="notice stack">
          <p>
            {state.emailed
              ? 'Created. The owner was emailed this invitation link. It is shown here only once:'
              : 'Created. The email could not be sent: send this owner invitation link yourself now — it is shown only once:'}
          </p>
          <input readOnly value={state.link} aria-label="Owner invitation link" style={{ width: '100%' }} />
        </div>
      )}
    </form>
  );
}
