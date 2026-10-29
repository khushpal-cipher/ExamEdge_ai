'use client';

import { useEffect, useRef } from 'react';

type Row = { rank: number; average: number; name: string; me: boolean };

// Scrollable rank list inside the "Overall rank" tile. Always opens on the student's own row. Other students' rows
// blur more the further they are from the middle of the box.
export function RankScroller({ rows }: { rows: Row[] }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const paint = () => {
      const mid = el.scrollTop + el.clientHeight / 2;
      items.forEach((it) => {
        const d = Math.abs(it.offsetTop + it.offsetHeight / 2 - mid) / it.offsetHeight;
        it.style.setProperty('--blur', it.dataset.me ? '0px' : `${Math.min(d * 2, 5).toFixed(1)}px`);
        it.style.opacity = String(Math.max(0.25, 1 - d * 0.35));
      });
    };
    const me = items.find((i) => i.dataset.me);
    if (me) el.scrollTop = me.offsetTop - (el.clientHeight - me.offsetHeight) / 2;
    paint();
    el.addEventListener('scroll', paint, { passive: true });
    return () => el.removeEventListener('scroll', paint);
  }, [rows]);

  return (
    <div className="rankbox" ref={box} tabIndex={0} role="list" aria-label="Rank list of your batch">
      {rows.map((r, i) => (
        <div key={i} className="rankrow" role="listitem" data-me={r.me ? '1' : undefined}>
          <b>#{r.rank}</b>
          <span className="who">{r.me ? 'You' : r.name}</span>
          <span className="avg">{r.average}%</span>
        </div>
      ))}
    </div>
  );
}
