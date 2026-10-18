// Phase 5 + ADR-041 part 2: the institute's Bill page (owner/admin only, ₹ only) and metering isolation. Needs
// `npm run seed:demo` (the seed's document ingestion is metered, so Demo and Rival both have usage this month).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, signedIn, instituteId, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

test('owner sees this month’s AI bill in ₹ only; teachers and students do not', async ({ page }) => {
  await sql(`update private.settings set inr_per_usd = 90 where id`);
  await login(page, 'owner@demo.test');
  await page.getByRole('link', { name: 'Bill' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bill');
  await expect(page.locator('.stat').filter({ hasText: "This month's AI charge" }).locator('b')).toHaveText(
    /^₹[\d,]+\.\d{2}$/,
  );
  await expect(page.getByText(/tokens|\$/)).toHaveCount(0);
  await expect(page.getByText('On', { exact: true })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);

  await page.context().clearCookies();
  await login(page, 'teacher1@demo.test');
  await expect(page.getByRole('link', { name: 'Bill' })).toHaveCount(0);
  expect((await page.goto(`${DEMO}/usage`))?.status()).toBe(404);

  await page.context().clearCookies();
  await login(page, 'student01@demo.test');
  expect((await page.goto(`${DEMO}/usage`))?.status()).toBe(404);
});

test('usage records stay inside their institute (T-ISO-02 for metering)', async () => {
  const demo = await instituteId('demo.localhost');
  const rival = await signedIn('owner@rival.test');
  expect((await rival.from('usage_records').select('id').eq('institute_id', demo)).data).toEqual([]);
  expect((await rival.rpc('usage_summary', { inst: demo })).data).toEqual([]);
  const own = ((await rival.rpc('platform_usage')).data ?? []) as { institute_id: string }[];
  expect(own.length).toBe(1);
  expect(own.map((r) => r.institute_id)).not.toContain(demo); // the platform table's numbers: own institute only
  const { error } = await rival.rpc('ai_reserve', { inst: demo, feat: 'tutor', prov: 'fake', mdl: 'fake', reserve: 1 });
  expect(error?.message).toBe('not_allowed');
  const student = await signedIn('student01@demo.test');
  expect((await student.from('usage_records').select('id')).data).toEqual([]);
});
