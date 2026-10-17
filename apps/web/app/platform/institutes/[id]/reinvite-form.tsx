'use client';

import { useActionState } from 'react';
import { reinviteOwner, type CreateState } from '../../actions';

export function ReinviteOwner({ instituteId }: { instituteId: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(reinviteOwner, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="institute_id" value={instituteId} />
      <div className="inline">
        <label>
          Owner email
          <input name="owner_email" type="email" required maxLength={254} />
        </label>
        <button type="submit" disabled={pending}>
          Send new owner invitation
        </button>
      </div>
      {state && 'error' in state && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      {state && 'link' in state && (
        <div role="status" className="notice stack">
          <p>
            {state.emailed
              ? 'Sent. Earlier owner links no longer work. The new link is shown here only once:'
              : 'Earlier owner links no longer work. The email could not be sent: send this link yourself now — it is shown only once:'}
          </p>
          <input readOnly value={state.link} aria-label="Owner invitation link" style={{ width: '100%' }} />
        </div>
      )}
    </form>
  );
}
