import { afterEach, expect, it, vi } from 'vitest';
import { updateInrRate } from './rate';

const pool = () => ({ query: vi.fn(async () => ({ rows: [{ saved: true }] })) });
const reply = (body: unknown, ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body })),
  );

afterEach(() => vi.unstubAllGlobals());

it('saves the fetched rate', async () => {
  reply({ rates: { INR: 94.95 } });
  const p = pool();
  expect(await updateInrRate(p as never)).toEqual({ rate: 94.95, saved: true });
  expect(p.query).toHaveBeenCalledWith('select private.auto_inr_per_usd($1) as saved', [94.95]);
});

it('saves nothing when the source fails or answers without a rate', async () => {
  const p = pool();
  reply({}, false);
  expect(await updateInrRate(p as never)).toEqual({ rate: null, saved: false });
  reply({ rates: {} });
  expect(await updateInrRate(p as never)).toEqual({ rate: null, saved: false });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new Error('offline'))),
  );
  expect(await updateInrRate(p as never)).toEqual({ rate: null, saved: false });
  expect(p.query).not.toHaveBeenCalled();
});
