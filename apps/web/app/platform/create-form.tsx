'use client';

import { CopyField } from '../copy-button';
import { useActionState } from 'react';
import { createInstitute, type CreateState } from './actions';

export function CreateInstitute({ root, today, defaultEnd }: { root: string; today: string; defaultEnd: string }) {
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
          <input
            name="slug"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9-]{3,40}"
            title="3–40 characters: lowercase letters, digits or hyphens"
            placeholder="sharma"
          />
        </label>
        <label>
          Owner email
          <input name="owner_email" type="email" required maxLength={254} />
        </label>
        <label>
          How many students do you have?
          <input name="students" type="number" min={0} max={1000000} />
        </label>
        <label>
          Free pilot ends (last day)
          <input name="ends" type="date" required min={today} defaultValue={defaultEnd} />
        </label>
        <button type="submit" className="primary" disabled={pending}>
          Create institute
        </button>
      </div>
      <p className="small muted">
        The address becomes &lt;subdomain&gt;.{root}: at least 3 characters (lowercase letters, digits or hyphens). A
        new institute is a free pilot: 10 students, 20 staff, $10 of AI; read-only from the day after it ends.
      </p>
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
          <CopyField value={state.link} label="Owner invitation link" />
        </div>
      )}
    </form>
  );
}
