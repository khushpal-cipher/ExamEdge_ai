import { describe, expect, it } from 'vitest';
import { demoLoginAllowed, safeNext } from './demo';

describe('demoLoginAllowed', () => {
  const local = { DEMO_LOGIN_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' };
  it('allows only when enabled and Supabase is local', () => {
    expect(demoLoginAllowed(local)).toBe(true);
    expect(demoLoginAllowed({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' })).toBe(true);
  });
  it('refuses in any cloud or misconfigured environment', () => {
    expect(demoLoginAllowed({ ...local, DEMO_LOGIN_ENABLED: '1' })).toBe(false);
    expect(demoLoginAllowed({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' })).toBe(false);
    expect(demoLoginAllowed({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost.evil.com' })).toBe(false);
    expect(demoLoginAllowed({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toBe(false);
    expect(demoLoginAllowed({ DEMO_LOGIN_ENABLED: 'true' })).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps same-origin paths only', () => {
    expect(safeNext('/invite/abc')).toBe('/invite/abc');
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '', null])
      expect(safeNext(bad)).toBe('/');
  });
});
