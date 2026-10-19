'use client';

import { useEffect, useRef, useState } from 'react';

// Reads an audio/video overview aloud with the device's own voice (Web Speech API, free; ADR-050). Each part is
// marked on the page (aria-current on #part-N) while it is read. Chrome stops long utterances after ~15 s, so text
// is spoken one sentence at a time.
const spoken = (t: string) =>
  t
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/[\\{}^_*#`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const sentences = (t: string) => spoken(t).match(/[^.?!।]+[.?!।]*/g) ?? [];

export function Speaker({ parts, label }: { parts: string[]; label: string }) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [part, setPart] = useState(0);
  const run = useRef(0); // bumps on every stop, so callbacks of an old run do nothing

  useEffect(() => {
    if (!('speechSynthesis' in window)) setSupported(false); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only feature check after hydration
    return () => window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    document.querySelectorAll('[id^="part-"]').forEach((el, i) => {
      if (state !== 'idle' && i === part) {
        el.setAttribute('aria-current', 'true');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else el.removeAttribute('aria-current');
    });
  }, [part, state]);

  const voice = () => {
    const all = window.speechSynthesis.getVoices();
    return all.find((v) => v.lang === 'en-IN') ?? all.find((v) => v.lang.startsWith('en'));
  };
  const say = (p: number, s: number, id: number) => {
    if (id !== run.current) return;
    if (p >= parts.length) return void setState('idle');
    const list = sentences(parts[p]!);
    if (s >= list.length) return say(p + 1, 0, id);
    setPart(p);
    const u = new SpeechSynthesisUtterance(list[s]);
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-IN';
    u.onend = () => say(p, s + 1, id);
    window.speechSynthesis.speak(u);
  };
  const play = (from = 0) => {
    window.speechSynthesis.cancel();
    const id = ++run.current;
    setState('playing');
    say(from, 0, id);
  };
  const stop = () => {
    run.current++;
    window.speechSynthesis.cancel();
    setState('idle');
  };

  if (!supported) return <p className="notice">This browser cannot read aloud. Read the script below instead.</p>;
  return (
    <div className="speaker" role="group" aria-label={label}>
      {state === 'idle' ? (
        <button type="button" className="primary" onClick={() => play(0)}>
          ▶ Play
        </button>
      ) : state === 'playing' ? (
        <button type="button" className="primary" onClick={() => (window.speechSynthesis.pause(), setState('paused'))}>
          Pause
        </button>
      ) : (
        <button
          type="button"
          className="primary"
          onClick={() => (window.speechSynthesis.resume(), setState('playing'))}
        >
          Resume
        </button>
      )}
      <button type="button" onClick={() => play(Math.max(0, part - 1))} disabled={state === 'idle'}>
        Previous
      </button>
      <button type="button" onClick={() => play(part + 1)} disabled={state === 'idle' || part >= parts.length - 1}>
        Next
      </button>
      <button type="button" onClick={stop} disabled={state === 'idle'}>
        Stop
      </button>
      <span className="small muted" aria-live="polite">
        {state === 'idle' ? `${parts.length} parts` : `Part ${part + 1} of ${parts.length}`}
      </span>
    </div>
  );
}
