import { expect, test } from 'vitest';
import { budgetLevel, usd } from './usage';

test('budget alert levels at 50, 80 and 100 %', () => {
  expect(budgetLevel(0, 1000)).toBe(0);
  expect(budgetLevel(499, 1000)).toBe(0);
  expect(budgetLevel(500, 1000)).toBe(50);
  expect(budgetLevel(800, 1000)).toBe(80);
  expect(budgetLevel(1200, 1000)).toBe(100);
  expect(budgetLevel(0, 0)).toBe(100);
});

test('formats micro-USD as dollars', () => {
  expect(usd(20_000_000)).toBe('$20.00');
  expect(usd(1)).toBe('$0.00');
});
