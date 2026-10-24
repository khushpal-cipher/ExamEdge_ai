import { TZ } from './assess';

// Study streak and XP from activity the student already leaves (doubts, tests, study tools); nothing is stored.
export const XP = { doubt: 10, test: 50, tool: 20 } as const;
export const DAILY_GOAL = 3;
const LEVEL_XP = 200;

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD in IST

/** Consecutive active days ending today, or yesterday (today not started yet keeps the streak alive). */
export function streak(times: string[], now: number): number {
  const days = new Set(times.map((t) => dayKey(new Date(t))));
  const day = (n: number) => dayKey(new Date(now - n * 86_400_000));
  let n = days.has(day(0)) ? 0 : 1;
  let count = 0;
  while (days.has(day(n))) {
    count++;
    n++;
  }
  return count;
}

/** The last 7 days, oldest first: weekday letter and whether the student studied that day. */
export function week(times: string[], now: number) {
  const days = new Set(times.map((t) => dayKey(new Date(t))));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86_400_000);
    return {
      label: new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'narrow' }).format(d),
      active: days.has(dayKey(d)),
      today: i === 6,
    };
  });
}

export const isToday = (t: string, now: number) => dayKey(new Date(t)) === dayKey(new Date(now));

export function level(xp: number) {
  return { level: Math.floor(xp / LEVEL_XP) + 1, into: xp % LEVEL_XP, need: LEVEL_XP };
}
