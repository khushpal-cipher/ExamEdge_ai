'use client';

import { useState } from 'react';

const TABS = [
  ['sources', 'Sources'],
  ['tutor', 'AI tutor'],
  ['studio', 'Studio'],
] as const;
type Tab = (typeof TABS)[number][0];

// Three panes side by side on desktop; on phones only the selected one shows (CSS hides the rest).
export function Panes(props: Record<Tab, React.ReactNode>) {
  const [tab, setTab] = useState<Tab>('tutor');
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Subject sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-controls={`pane-${key}`}
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panes">
        {TABS.map(([key]) => (
          <section
            key={key}
            id={`pane-${key}`}
            role="tabpanel"
            aria-labelledby={`tab-${key}`}
            className="card stack"
            data-hidden={tab !== key}
          >
            {props[key]}
          </section>
        ))}
      </div>
    </>
  );
}
