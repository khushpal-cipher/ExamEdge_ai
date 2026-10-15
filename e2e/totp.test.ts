import { expect, test } from 'vitest';
import { totp } from './totp';

// RFC 6238 appendix B vectors (SHA-1 secret "12345678901234567890"), last 6 digits.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // gitleaks:allow — public RFC 6238 test key (base32 of "12345678901234567890")
test.each([
  [59, '287082'],
  [1111111109, '081804'],
  [1234567890, '005924'],
  [2000000000, '279037'],
])('totp at %i s', (t, code) => expect(totp(SECRET, t * 1000)).toBe(code));
