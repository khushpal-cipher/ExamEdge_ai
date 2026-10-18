'use client';

import type { StudentBatch } from '@/lib/student';
import { chooseBatch } from './actions';

// Choosing a batch switches at once (ADR-043); the Show button is only for browsers without JavaScript.
export function BatchSwitcher({ list, selected }: { list: StudentBatch[]; selected: string }) {
  return (
    <form action={chooseBatch} className="switcher">
      <label>
        <span>Batch</span>
        <select
          name="batch"
          defaultValue={selected}
          key={selected}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {list.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.leftAt ? ' (past)' : ''}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit">Show</button>
      </noscript>
    </form>
  );
}
