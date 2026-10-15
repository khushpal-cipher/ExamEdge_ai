import { describe, expect, it } from 'vitest';
import { findViolations } from './check-forbidden';

describe('check-forbidden (T-SEC-08)', () => {
  it('flags session-level tenant settings in worker code', () => {
    expect(findViolations('apps/worker/src/a.ts', "q(`select set_config('app.institute_id', $1, false)`)")).toContain(
      'session-set_config',
    );
    expect(findViolations('apps/worker/src/a.ts', "q('SET app.institute_id = 1')")).toContain('session-SET');
    expect(findViolations('apps/worker/src/a.ts', "q('set role worker')")).toContain('session-SET');
  });

  it('allows transaction-local settings', () => {
    expect(findViolations('apps/worker/src/a.ts', "q(`select set_config('app.institute_id', $1, true)`)")).toEqual([]);
    expect(findViolations('apps/worker/src/a.ts', "q('SET LOCAL statement_timeout = 5000')")).toEqual([]);
  });

  it('flags provider SDKs outside the gateway only', () => {
    expect(findViolations('apps/web/app/x.ts', "import Anthropic from '@anthropic-ai/sdk'")).toContain(
      'provider-sdk-outside-gateway',
    );
    expect(findViolations('packages/core/src/ai/anthropic.ts', "import Anthropic from '@anthropic-ai/sdk'")).toEqual(
      [],
    );
  });

  it('flags raw HTML injection and secret keys in runtime code', () => {
    expect(findViolations('apps/web/app/p.tsx', '<div dangerouslySetInnerHTML={x} />')).toContain(
      'dangerouslySetInnerHTML',
    );
    expect(findViolations('apps/web/lib/s.ts', 'process.env.SUPABASE_SECRET_KEY')).toContain('secret-key-in-runtime');
    expect(findViolations('scripts/ops.ts', 'process.env.SUPABASE_SECRET_KEY')).toEqual([]);
  });
});
