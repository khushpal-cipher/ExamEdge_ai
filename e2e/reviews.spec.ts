// ADR-047: a student writes a review (named or with the name hidden); only owner/admin read it, teachers never,
// and another institute cannot. Needs `npm run seed:demo`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, signedIn, instituteId } from './helpers';

const DEMO = 'http://demo.localhost:3000';

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

test('student reviews reach only the owner/admin, who reply; a hidden name is not stored', async ({ page }) => {
  const tag = Date.now().toString(36);
  await login(page, 'student01@demo.test');
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review');
  await page.getByLabel('Your review').fill(`Named review ${tag}`);
  await page.getByRole('button', { name: 'Send review' }).click();
  await expect(page.getByRole('status')).toHaveText('Thank you. Your review was sent to the owner and admins.');
  await page.getByLabel('Your review').fill(`Hidden review ${tag}`);
  await page.getByLabel('Hide my name').check();
  await page.getByRole('button', { name: 'Send review' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);

  await login(page, 'owner@demo.test');
  await page.getByRole('link', { name: 'Reviews' }).click();
  const named = page.getByRole('article').filter({ hasText: `Named review ${tag}` });
  const hidden = page.getByRole('article').filter({ hasText: `Hidden review ${tag}` });
  await expect(named).not.toContainText('Anonymous');
  await expect(named).toContainText('JEE 2027 Morning');
  await expect(hidden).toContainText('Anonymous');
  const owner = await signedIn('owner@demo.test');
  const { data } = await owner.from('reviews').select('user_id').eq('body', `Hidden review ${tag}`).single();
  expect(data?.user_id).toBeNull(); // not just hidden on screen: never stored
  await named.getByLabel('Your reply').fill(`Thanks ${tag}`);
  await named.getByRole('button', { name: 'Reply' }).click();
  await expect(page.getByRole('status')).toHaveText('Reply saved.');
  await expect(hidden.getByText('anonymous: the student will not see it')).toBeVisible();

  await login(page, 'student01@demo.test');
  await page.goto(`${DEMO}/reviews`);
  const mine = page.getByRole('region', { name: 'Your reviews' });
  await expect(mine.getByRole('article').filter({ hasText: `Named review ${tag}` })).toContainText(`Thanks ${tag}`);
  await expect(mine.getByText(`Hidden review ${tag}`)).toHaveCount(0);

  await login(page, 'teacher1@demo.test');
  await expect(page.getByRole('link', { name: 'Reviews' })).toHaveCount(0);
  expect((await page.goto(`${DEMO}/reviews`))?.status()).toBe(404);
  expect((await (await signedIn('teacher1@demo.test')).from('reviews').select('id')).data).toEqual([]);

  const demo = await instituteId('demo.localhost');
  const rival = await signedIn('owner@rival.test');
  expect((await rival.from('reviews').select('id').eq('institute_id', demo)).data).toEqual([]);
});
