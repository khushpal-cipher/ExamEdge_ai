'use client';

import { useState } from 'react';

// The topic page's tabs (ADR-038, ADR-039): Subtopics first, so notes and "Upload notes" are what a phone opens on;
// then Smart Study (students) or AI test (staff).
export function Tabs({
  tabs,
  label = 'Topic sections',
  initial,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
  label?: string;
  initial?: string;
}) {
  const [tab, setTab] = useState(initial ?? tabs[0]!.key);
  return (
    <>
      <div className="tabs always" role="tablist" aria-label={label}>
        {tabs.map(({ key, label }) => (
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
      {tabs.map(({ key, content }) => (
        <div key={key} id={`pane-${key}`} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={tab !== key}>
          {content}
        </div>
      ))}
    </>
  );
}
