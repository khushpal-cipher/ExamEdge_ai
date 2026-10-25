import { describe, expect, it } from 'vitest';
import { assertLiveAi, demoLoginAllowed, safeNext } from './demo';

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

describe('assertLiveAi', () => {
  const local = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' };
  it('allows fake AI only on a local stack', () => {
    expect(() => assertLiveAi(local)).not.toThrow();
    expect(() => assertLiveAi({ ...local, AI_PROVIDER: 'gemini' })).not.toThrow();
  });
  it('requires anthropic on a live server, including when AI_PROVIDER is unset', () => {
    const live = { NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' };
    expect(() => assertLiveAi(live)).toThrow();
    expect(() => assertLiveAi({ ...live, AI_PROVIDER: 'gemini' })).toThrow();
    expect(() => assertLiveAi({ ...live, AI_PROVIDER: 'fake' })).toThrow();
    expect(() => assertLiveAi({ ...live, AI_PROVIDER: 'anthropic' })).not.toThrow();
    expect(() => assertLiveAi({})).toThrow();
  });
});
