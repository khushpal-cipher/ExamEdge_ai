import { describe, expect, it } from 'vitest';
import { blocking } from './check-audit';

const audit = {
  vulnerabilities: {
    a: { via: [{ url: 'https://github.com/advisories/GHSA-high', severity: 'high' }] },
    b: { via: ['a', { url: 'https://github.com/advisories/GHSA-low', severity: 'moderate' }] },
  },
};

describe('check-audit (T-SEC-17)', () => {
  it('blocks high advisories without an exception', () => {
    expect(blocking(audit, '2026-10-15', {})).toEqual(['GHSA-high']);
  });
  it('allows a listed exception until it expires', () => {
    const allowed = { 'GHSA-high': { reason: 'x', expires: '2026-12-31' } };
    expect(blocking(audit, '2026-10-15', allowed)).toEqual([]);
    expect(blocking(audit, '2027-01-01', allowed)).toEqual(['GHSA-high']);
  });
});
