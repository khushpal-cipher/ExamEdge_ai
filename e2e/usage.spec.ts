// Phase 5: institute AI usage page (owner/admin only) and its tenant isolation. Needs `npm run seed:demo`
// (the seed's document ingestion is metered, so Demo and Rival both have usage this month).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, signedIn, instituteId } from './helpers';

const DEMO = 'http://demo.localhost:3000';

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

test('owner sees this month’s AI usage and budget; teachers and students do not', async ({ page }) => {
  await login(page, 'owner@demo.test');
  await page.getByRole('link', { name: 'AI usage' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI usage');
  await expect(page.getByRole('cell', { name: 'Indexing notes' })).toBeVisible();
  await expect(page.getByText('of $20.00 budget')).toBeVisible();
  await expect(page.getByText('On', { exact: true })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);

  await page.context().clearCookies();
  await login(page, 'teacher1@demo.test');
  await expect(page.getByRole('link', { name: 'AI usage' })).toHaveCount(0);
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
  const { error } = await rival.rpc('ai_reserve', { inst: demo, feat: 'tutor', prov: 'fake', mdl: 'fake', reserve: 1 });
  expect(error?.message).toBe('not_allowed');
  const student = await signedIn('student01@demo.test');
  expect((await student.from('usage_records').select('id')).data).toEqual([]);
});
