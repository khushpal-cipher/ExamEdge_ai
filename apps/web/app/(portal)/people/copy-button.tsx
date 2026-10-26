'use client';

import { useState } from 'react';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // no clipboard permission (e.g. plain http): the text stays selectable
  }
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <button
      type="button"
      className="link"
      aria-label={label}
      title={label}
      onClick={async () => {
        setState((await copyText(text)) ? 'ok' : 'fail');
        setTimeout(() => setState('idle'), 1500);
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </svg>
      <span role="status" className="small">
        {state === 'ok' ? ' Copied' : state === 'fail' ? ' Select and copy' : ''}
      </span>
    </button>
  );
}

// Info icon next to "Paste a list": opens on hover, focus and click/tap (hover alone fails on phones and keyboards).
export function PromptHelp({ batches }: { batches: string[] }) {
  const [open, setOpen] = useState(false);
  const prompt =
    `I have a list of people to invite to a coaching institute. Turn it into plain text, one person per line, ` +
    `in exactly this format: email,name,role,batch\n` +
    `- role is student or teacher (leave empty for student)\n` +
    `- batch must be one of: ${batches.length ? batches.join(' | ') : '(no batches yet)'} (leave empty if none)\n` +
    `- no header line, no quotes, no extra text, no spaces around commas\n` +
    `Here is my list:\n`;
  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="link"
        aria-label="Have an Excel sheet? Let ChatGPT format it"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 11v6M12 7.5v.01" />
        </svg>
      </button>
      {open && (
        <div
          className="card stack"
          role="dialog"
          aria-label="ChatGPT prompt"
          style={{ position: 'absolute', zIndex: 10, left: 0, top: '100%', width: 'min(420px, 80vw)' }}
        >
          <p className="small">
            Have an Excel sheet? Paste this into ChatGPT, then add your list under it. Paste ChatGPT&apos;s answer into
            the box. Every line is still checked here.
          </p>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {prompt}
          </pre>
          <div>
            <CopyButton text={prompt} label="Copy prompt" />
          </div>
        </div>
      )}
    </span>
  );
}
