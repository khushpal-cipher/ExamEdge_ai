import { expect, test } from 'vitest';
import { usd } from './usage';

test('formats micro-USD as dollars', () => {
  expect(usd(20_000_000)).toBe('$20.00');
  expect(usd(1)).toBe('$0.00');
});
