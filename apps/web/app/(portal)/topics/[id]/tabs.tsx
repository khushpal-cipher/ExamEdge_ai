'use client';

import { useState } from 'react';

const TABS = [
  ['subtopics', 'Subtopics'],
  ['study', 'Smart Study'],
] as const;
type Tab = (typeof TABS)[number][0];

// The topic page's two tabs (ADR-038); Subtopics first, so notes and "Upload notes" are what a phone opens on.
export function Tabs(props: Record<Tab, React.ReactNode>) {
  const [tab, setTab] = useState<Tab>('subtopics');
  return (
    <>
      <div className="tabs always" role="tablist" aria-label="Topic sections">
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
      {TABS.map(([key]) => (
        <div key={key} id={`pane-${key}`} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={tab !== key}>
          {props[key]}
        </div>
      ))}
    </>
  );
}
