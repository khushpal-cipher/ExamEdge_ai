import { afterEach, expect, it, vi } from 'vitest';
import { remindRenewals } from './renewal';

const due = { institute_id: 'i1', name: 'Newtown', paid_until: '2026-11-30', owners: ['o@x.test'] };
const pool = () => ({ query: vi.fn(async (q: string) => ({ rows: q.includes('renewals_due') ? [due] : [] })) });

afterEach(() => vi.unstubAllGlobals());

it('sends nothing and marks nothing without a Resend key', async () => {
  const p = pool();
  expect(await remindRenewals(p as never, {})).toEqual({ due: 0, sent: 0 });
  expect(p.query).not.toHaveBeenCalled();
});

it('marks an institute reminded only when Resend accepts the email', async () => {
  const p = pool();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false })),
  );
  expect(await remindRenewals(p as never, { RESEND_API_KEY: 'k' })).toEqual({ due: 1, sent: 0 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true })),
  );
  expect(await remindRenewals(p as never, { RESEND_API_KEY: 'k' })).toEqual({ due: 1, sent: 1 });
  expect(p.query).toHaveBeenCalledWith('select private.mark_reminded($1, $2)', ['i1', '2026-11-30']);
});
