// Daily ₹ per US$ rate (ECB reference rate via Frankfurter, no key). The database refuses a rate outside 50-200.
// Logs the rate only.
import type pg from 'pg';
import { log } from '@examedge/core/log';

export async function updateInrRate(pool: pg.Pool) {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR', {
    signal: AbortSignal.timeout(15_000),
  }).catch((err: Error) => {
    log.warn('rate.fetch_failed', { reason: err.name });
    return null;
  });
  if (res && !res.ok) log.warn('rate.fetch_failed', { status: res.status });
  const rate = res?.ok
    ? ((await res.json().catch(() => null)) as { rates?: { INR?: number } } | null)?.rates?.INR
    : null;
  if (typeof rate !== 'number') return { rate: null, saved: false };
  const { rows } = await pool.query<{ saved: boolean }>('select private.auto_inr_per_usd($1) as saved', [rate]);
  return { rate, saved: rows[0]?.saved ?? false };
}
