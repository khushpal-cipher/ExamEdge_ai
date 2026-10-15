import { expect, test } from 'vitest';
import { brandStyle } from './brand';

test('picks the readable text colour for a brand colour', () => {
  expect(brandStyle('#d97757')).toMatchObject({ '--on-accent': '#141413' }); // light orange → ink
  expect(brandStyle('#1d3557')).toMatchObject({ '--on-accent': '#ffffff' }); // navy → white
  expect(brandStyle('#ffff00')).toMatchObject({ '--on-accent': '#141413' });
});

test('ignores anything that is not a strict hex colour (it is rendered into CSS)', () => {
  expect(brandStyle(undefined)).toBeUndefined();
  expect(brandStyle('red;}body{x')).toBeUndefined();
});
