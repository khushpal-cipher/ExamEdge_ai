// Free pilot (ADR-058): days left and whether it has ended, from the institute's India-date pilot_end.
import { TZ } from './assess';

/** YYYY-MM-DD in India time, `days` after `d`. */
export const indiaDate = (d = new Date(), days = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d.getTime() + days * 86_400_000));

export type Pilot = { daysLeft: number; ended: boolean } | null;

// shortcut: mirrors the pilot rule of private.read_only() (read-only from midnight IST after pilot_end); expose that
// function through an RPC when Batch C adds the paid rules to it.
export function pilotState(status: string, pilotEnd: string | null, today = indiaDate()): Pilot {
  if (status !== 'pilot' || !pilotEnd) return null;
  const daysLeft = Math.round((Date.parse(pilotEnd) - Date.parse(today)) / 86_400_000) + 1; // the last day counts
  return { daysLeft: Math.max(daysLeft, 0), ended: daysLeft <= 0 };
}

export type Paid = { daysLeft: number; ended: boolean } | null;

// shortcut: mirrors the paid rule of private.read_only(): the last paid day counts, then read-only from the following
// midnight IST (no grace). Old institutes without paid_until are never read-only.
export function paidState(status: string, paidUntil: string | null, today = indiaDate()): Paid {
  if (status !== 'active' || !paidUntil) return null;
  const daysLeft = Math.round((Date.parse(paidUntil) - Date.parse(today)) / 86_400_000) + 1;
  return { daysLeft: Math.max(daysLeft, 0), ended: daysLeft <= 0 };
}
