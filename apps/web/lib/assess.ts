// Shared helpers for tests: India time for form inputs and display, the derived test phase, CSV export.

// shortcut: every institute is in India (IST, UTC+5:30, no DST); add institutes.timezone when one is not.
const IST_OFFSET_MS = 330 * 60_000;
export const TZ = 'Asia/Kolkata';

// <input type="datetime-local"> value (IST wall time) → ISO instant, or null when malformed.
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const toLocalInput = (iso: string) =>
  new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const formatDuration = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
};

export const TYPE_SHORT: Record<string, string> = {
  single: 'MCQ',
  multi: 'MCQ (multi)',
  numerical: 'Numerical',
  written: 'Written',
};

// Request time for Server Components (rendered once per request, so reading the clock here is intended).
export const requestTime = () => Date.now();

export type TestRow = { status: string; opens_at: string; closes_at: string };
export type Phase = 'draft' | 'upcoming' | 'open' | 'closed' | 'released' | 'cancelled';

// "closed" covers both waiting-for-checking and ready-to-release; the DB decides on release (ADR-023).
export function testPhase(t: TestRow, now = Date.now()): Phase {
  if (t.status === 'draft' || t.status === 'cancelled') return t.status;
  if (t.status === 'results_released') return 'released';
  if (now < Date.parse(t.opens_at)) return 'upcoming';
  return now < Date.parse(t.closes_at) ? 'open' : 'closed';
}

export const PHASE_LABEL: Record<Phase, string> = {
  draft: 'Draft',
  upcoming: 'Scheduled',
  open: 'Open now',
  closed: 'Closed',
  released: 'Results released',
  cancelled: 'Cancelled',
};

// RFC 4180 quoting, plus a leading ' on cells that a spreadsheet would run as a formula (names are user-editable).
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export const pct = (score: number | null | undefined, max: number | null | undefined) =>
  score == null || !max ? null : Math.round((score / max) * 10000) / 100;

// CBT tests (ADR-048): the warning that submits the attempt; same number as public.cbt_warning().
export const CBT_WARNINGS = 3;
