// R1.1 step 6 (ADR-040): the student Contest page and the batch switcher (own time in a past batch).
// Needs `npm run seed:demo`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/home$/);
}

const batchId = async (name: string) =>
  (
    await sql(
      `select b.id from batches b join institutes i on i.id = b.institute_id where i.slug = 'demo' and b.name = $1`,
      [name],
    )
  ).rows[0].id as string;

test('Contest lists every test of the batch by phase; a forged batch cookie is ignored', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, 'student01@demo.test');
  // A batch the student is not in: the switcher only picks among their own batches.
  await page.context().addCookies([{ name: 'batch', value: await batchId('NEET 2027 Evening'), url: DEMO }]);
  await page.getByRole('link', { name: 'Contest' }).click();
  await expect(page).toHaveURL(/\/contests$/);
  await expect(page.getByRole('heading', { name: 'Contest', level: 1 })).toBeVisible();
  await expect(page.getByText('JEE 2027 Morning', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0); // one batch → no switcher

  const section = (name: string) => page.getByRole('region', { name });
  await expect(section('Live now').getByText('Physics Practice Test')).toBeVisible();
  await expect(section('Live now').getByRole('link', { name: /Start|Continue/ })).toBeVisible();
  await expect(section('Upcoming').getByText('Maths Test 4')).toBeVisible();
  await expect(section('Finished · waiting for results').getByText('Chemistry Test 3')).toBeVisible();
  await expect(section('Results').getByText('Physics Test 1')).toBeVisible();
  await expect(section('Results').getByText('Mixed Test 2')).toBeVisible();
  await expect(section('Results')).toContainText(/rank \d+/);
  await expect(page.getByText(/NEET/)).toHaveCount(0);
  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(375);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([]);
});

test('a promoted student switches to the past batch and sees only their own time there', async ({ page }) => {
  const email = 'student24@demo.test';
  const jee = await batchId('JEE 2027 Morning');
  const name = `E2E Class ${Date.now().toString(36)}`;
  const mid = (
    await sql(
      `select m.id from memberships m join auth.users u on u.id = m.user_id join institutes i on i.id = m.institute_id
       where i.slug = 'demo' and u.email = $1`,
      [email],
    )
  ).rows[0].id as string;
  // Promoted three days ago into a new batch of its own (other specs count NEET's students): the JEE row is kept
  // with left_at.
  const next = (
    await sql(
      `insert into batches (institute_id, name) select institute_id, $1 from batches where id = $2 returning id`,
      [name, jee],
    )
  ).rows[0].id as string;
  await sql(`update batch_members set left_at = now() - interval '3 days' where batch_id = $1 and membership_id = $2`, [
    jee,
    mid,
  ]);
  await sql(
    `insert into batch_members (batch_id, membership_id, institute_id, batch_role, created_at)
     select $1, id, institute_id, 'student', now() - interval '3 days' from memberships where id = $2`,
    [next, mid],
  );
  try {
    await login(page, email);
    await expect(page.getByText(name, { exact: true })).toBeVisible(); // current batch by default
    await page.getByRole('link', { name: 'Contest' }).click();
    await expect(page.getByText('No tests in this batch yet.')).toBeVisible();

    await page.getByRole('combobox').selectOption({ label: 'JEE 2027 Morning (past)' });
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page.getByText(/JEE 2027 Morning · past batch/)).toBeVisible();
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByText('Physics Test 1')).toBeVisible();
    await expect(results.getByText('Mixed Test 2')).toBeVisible();
    // Held after they left: not theirs.
    await expect(page.getByText('Chemistry Test 3')).toHaveCount(0);
    await expect(page.getByText('Physics Practice Test')).toHaveCount(0);
    await expect(page.getByText('Maths Test 4')).toHaveCount(0);

    await page.getByRole('link', { name: 'My progress' }).click();
    await expect(page.getByText('JEE 2027 Morning', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mixed Test 2').first()).toBeVisible();
    await expect(page.getByText('Chemistry Test 3')).toHaveCount(0);
  } finally {
    await sql('delete from batch_members where batch_id = $1', [next]);
    await sql('delete from batches where id = $1', [next]);
    await sql('update batch_members set left_at = null where batch_id = $1 and membership_id = $2', [jee, mid]);
  }
});
