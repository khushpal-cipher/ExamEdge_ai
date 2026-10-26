import { describe, expect, it } from 'vitest';
import { indiaDate, pilotState } from './pilot';

describe('pilotState', () => {
  it('is null for institutes that are not pilots', () => {
    expect(pilotState('active', '2026-10-30', '2026-10-25')).toBeNull();
    expect(pilotState('pilot', null, '2026-10-25')).toBeNull();
  });
  it('counts the last day as a day left', () => {
    expect(pilotState('pilot', '2026-11-01', '2026-10-25')).toEqual({ daysLeft: 8, ended: false });
    expect(pilotState('pilot', '2026-10-25', '2026-10-25')).toEqual({ daysLeft: 1, ended: false });
  });
  it('ends the day after pilot_end', () => {
    expect(pilotState('pilot', '2026-10-24', '2026-10-25')).toEqual({ daysLeft: 0, ended: true });
    expect(pilotState('pilot', '2026-09-01', '2026-10-25')).toEqual({ daysLeft: 0, ended: true });
  });
});

describe('indiaDate', () => {
  it('uses India time', () => {
    expect(indiaDate(new Date('2026-10-25T18:29:00Z'))).toBe('2026-10-25');
    expect(indiaDate(new Date('2026-10-25T18:30:00Z'))).toBe('2026-10-26');
    expect(indiaDate(new Date('2026-10-25T00:00:00Z'), 7)).toBe('2026-11-01');
  });
});
