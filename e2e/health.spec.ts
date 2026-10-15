import { expect, test } from '@playwright/test';

test('health endpoint returns ok with commit and no-store', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  expect(await res.json()).toMatchObject({ status: 'ok', commit: expect.any(String) });
});
