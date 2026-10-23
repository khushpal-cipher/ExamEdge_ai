import { describe, expect, it } from 'vitest';
import { isToday, level, streak, week } from './streak';

const now = Date.parse('2026-10-23T12:00:00+05:30');
const ago = (days: number, hour = '10:00') =>
  new Date(Date.parse(`2026-10-23T${hour}:00+05:30`) - days * 86_400_000).toISOString();

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak([ago(0), ago(1), ago(1), ago(2), ago(4)], now)).toBe(3);
  });
  it('stays alive when today is not started yet', () => {
    expect(streak([ago(1), ago(2)], now)).toBe(2);
  });
  it('is 0 after a missed day', () => {
    expect(streak([ago(2), ago(3)], now)).toBe(0);
    expect(streak([], now)).toBe(0);
  });
  it('uses the IST day, not UTC', () => {
    // 00:30 IST on the 23rd is still the 22nd in UTC
    expect(streak(['2026-10-22T19:00:00Z'], now)).toBe(1);
    expect(isToday('2026-10-22T19:00:00Z', now)).toBe(true);
  });
});

describe('week and level', () => {
  it('marks active days, today last', () => {
    const w = week([ago(0), ago(6)], now);
    expect(w.map((d) => d.active)).toEqual([true, false, false, false, false, false, true]);
    expect(w[6]!.today).toBe(true);
  });
  it('levels every 200 XP', () => {
    expect(level(0)).toEqual({ level: 1, into: 0, need: 200 });
    expect(level(450)).toEqual({ level: 3, into: 50, need: 200 });
  });
});
