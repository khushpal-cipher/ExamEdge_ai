'use client';

import { useRef, useState } from 'react';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // no clipboard permission (e.g. plain http): the text stays selectable
  }
}

const COPY_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);
const CHECK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// Button with a label: "Copied" appears next to the icon for a moment.
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
      {state === 'ok' ? CHECK_ICON : COPY_ICON}
      <span role="status" className="small">
        {state === 'ok' ? ' Copied' : state === 'fail' ? ' Select and copy' : ''}
      </span>
    </button>
  );
}

// Read-only box with the copy icon inside its right end; the icon shows while the box is hovered or focused
// (always on touch screens). If the browser refuses the clipboard, the text is selected instead.
export function CopyField({
  value,
  label,
  copyLabel = 'Copy link',
}: {
  value: string;
  label: string;
  copyLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [ok, setOk] = useState(false);
  return (
    <div className="copyfield">
      <input ref={input} readOnly value={value} aria-label={label} />
      <button
        type="button"
        className="copy-btn"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={async () => {
          if (await copyText(value)) {
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          } else input.current?.select();
        }}
      >
        {ok ? CHECK_ICON : COPY_ICON}
        <span role="status" className="sr-only">
          {ok ? 'Copied' : ''}
        </span>
      </button>
    </div>
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
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 8,
        verticalAlign: 'middle',
      }}
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
          style={{
            position: 'absolute',
            zIndex: 10,
            left: 0,
            top: '100%',
            width: 'min(420px, 80vw)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <div className="row">
            <p className="small" style={{ flex: 1, margin: 0 }}>
              Have an Excel sheet? Copy this prompt into ChatGPT and add your list under it. Paste ChatGPT&apos;s answer
              into the box. Every line is still checked here.
            </p>
            <CopyButton text={prompt} label="Copy prompt" />
          </div>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {prompt}
          </pre>
        </div>
      )}
    </span>
  );
}
