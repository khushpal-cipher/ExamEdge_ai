'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// Wraps an AI form's buttons (ADR-054): while the request runs they are disabled (no double spend) and a status line
// says what is being made, NotebookLM style. The steps advance on a timer: they are a guide, not real progress.
export function Making({
  what,
  steps,
  names,
  children,
}: {
  what: string;
  steps: string[];
  names?: Record<string, string>;
  children: ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const kind = data?.get('kind');
  return (
    <>
      <fieldset disabled={pending} className="bare">
        {children}
      </fieldset>
      {pending && <Progress what={(typeof kind === 'string' && names?.[kind]) || what} steps={steps} />}
    </>
  );
}

function Progress({ what, steps }: { what: string; steps: string[] }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((i) => Math.min(i + 1, steps.length - 1)), 7000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="making" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>
        <b>Making {what}…</b>
        <div className="small muted">{steps[n]}</div>
        <div className="small muted">This can take a minute or two. Keep this page open.</div>
      </div>
    </div>
  );
}
