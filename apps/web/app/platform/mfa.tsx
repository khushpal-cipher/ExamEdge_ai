'use client';

import { useActionState } from 'react';
import { enrollTotp, verifyTotp, type EnrollState } from './actions';

function CodeForm({ factorId }: { factorId: string }) {
  return (
    <form action={verifyTotp} className="stack">
      <input type="hidden" name="factor_id" value={factorId} />
      <label>
        6-digit code from your authenticator app
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required />
      </label>
      <button type="submit" className="primary">
        Verify
      </button>
    </form>
  );
}

// First time: create a TOTP factor and show its QR code + secret; afterwards: ask for a code.
export function Mfa({ factorId }: { factorId: string | null }) {
  const [state, start, pending] = useActionState<EnrollState>(enrollTotp, null);
  if (factorId) return <CodeForm factorId={factorId} />;
  if (state && 'factorId' in state)
    return (
      <div className="stack">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI SVG from Supabase Auth */}
        <img src={state.qr} alt="QR code for your authenticator app" width={180} height={180} />
        <p className="small">
          Or enter this key: <code data-testid="totp-secret">{state.secret}</code>
        </p>
        <CodeForm factorId={state.factorId} />
      </div>
    );
  return (
    <form action={start} className="stack">
      {state && 'error' in state && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      <p>The platform admin area needs an authenticator app (two-factor sign-in).</p>
      <button type="submit" className="primary" disabled={pending}>
        Set up authenticator
      </button>
    </form>
  );
}
