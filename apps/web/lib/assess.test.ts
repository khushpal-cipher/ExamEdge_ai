import { expect, test } from 'vitest';
import { fromLocalInput, testPhase, toCsv, toLocalInput } from './assess';

test('datetime-local inputs are India time', () => {
  expect(fromLocalInput('2026-10-20T10:00')).toBe('2026-10-20T04:30:00.000Z');
  expect(toLocalInput('2026-10-20T04:30:00.000Z')).toBe('2026-10-20T10:00');
  expect(fromLocalInput('2026-10-20 10:00')).toBeNull();
  expect(fromLocalInput('2026-13-40T10:00')).toBeNull();
});

test('test phase follows status and the clock', () => {
  const t = { status: 'scheduled', opens_at: '2026-10-20T04:30:00Z', closes_at: '2026-10-20T06:30:00Z' };
  expect(testPhase(t, Date.parse('2026-10-20T04:00:00Z'))).toBe('upcoming');
  expect(testPhase(t, Date.parse('2026-10-20T04:30:00Z'))).toBe('open');
  expect(testPhase(t, Date.parse('2026-10-20T06:30:00Z'))).toBe('closed');
  expect(testPhase({ ...t, status: 'results_released' })).toBe('released');
  expect(testPhase({ ...t, status: 'draft' })).toBe('draft');
});

test('CSV quotes and defuses spreadsheet formulas', () => {
  expect(
    toCsv([
      ['Name', 'Score'],
      ['Riya, "R"', 12.5],
      ['=HYPERLINK("x")', -1],
      ['@me', null],
    ]),
  ).toBe('Name,Score\r\n"Riya, ""R""",12.5\r\n"\'=HYPERLINK(""x"")",-1\r\n\'@me,\r\n');
});
