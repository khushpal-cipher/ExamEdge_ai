// Phase 3 journeys: AC3.1 (each role), AC3.2 / T-SEC-05 (no caching of tenant pages), AC3.3 (axe), AC3.4 (students see
// only their batches' subjects), cross-tenant probes and the platform admin MFA flow. Needs `npm run seed:demo`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { admin, demoSignIn, instituteId, signedIn, sql } from './helpers';
import { totp } from './totp';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';
const ADMIN = 'http://admin.localhost:3000';

async function login(page: Page, base: string, email: string) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

async function noSeriousA11yIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function subjectId(host: string, name: string) {
  const owner = await signedIn(`owner@${host === 'demo.localhost' ? 'demo' : 'rival'}.test`);
  const { data } = await owner
    .from('subjects')
    .select('id')
    .eq('institute_id', await instituteId(host))
    .eq('name', name)
    .single();
  return data!.id as string;
}

test('owner sets up a batch, subject, chapter and invitations (AC3.1)', async ({ page }) => {
  const tag = Date.now().toString(36);
  await login(page, DEMO, 'owner@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await noSeriousA11yIssues(page);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Subjects' }).click();
  await page.getByLabel('Name', { exact: true }).fill(`Economics ${tag}`);
  await page.getByRole('button', { name: 'Create subject' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  const section = page.getByRole('region', { name: `Economics ${tag}` });
  await section.getByLabel('New chapter').fill('Demand and Supply');
  await section.getByRole('button', { name: 'Add chapter' }).click();
  await expect(page.getByRole('region', { name: `Economics ${tag}` }).getByLabel('Chapter name')).toHaveValue(
    'Demand and Supply',
  );

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Batches' }).click();
  await page.getByLabel('Name', { exact: true }).fill(`Commerce ${tag}`);
  await page.getByLabel('Academic year', { exact: true }).fill('2026-27');
  await page.getByRole('button', { name: 'Create batch' }).click();
  await page.getByRole('link', { name: `Commerce ${tag}` }).click();
  await page.getByLabel(`Economics ${tag}`).check();
  await page.getByRole('button', { name: 'Save subjects' }).click();
  await expect(page.getByLabel(`Economics ${tag}`)).toBeChecked();

  await page.goto(`${DEMO}/people?tab=invitations`);
  await page.getByLabel('Email', { exact: true }).fill(`kid-${tag}@demo.test`);
  await page.getByRole('combobox', { name: /^Batch/ }).selectOption({ label: `Commerce ${tag}` });
  await page.getByRole('button', { name: 'Create invitations' }).click();
  await expect(page.getByLabel(`Invitation link for kid-${tag}@demo.test`)).toHaveValue(
    /^http:\/\/demo\.localhost:3000\/invite\/[0-9a-f]{64}$/,
  );
  await noSeriousA11yIssues(page);

  // CSV: one good row (role + batch from the row), one bad email, one unknown batch.
  await page.getByLabel('Email', { exact: true }).fill('');
  await page.getByText('Invite many at once (CSV)').click();
  await page
    .getByLabel('Paste a list')
    .fill(
      `email,role,batch\nt-${tag}@demo.test,teacher,Commerce ${tag}\nnot-an-email\nx-${tag}@demo.test,student,Nope`,
    );
  await page.getByRole('button', { name: 'Create invitations' }).click();
  await expect(page.getByLabel(`Invitation link for t-${tag}@demo.test`)).toBeVisible();
  await expect(page.getByRole('row', { name: /not-an-email/ })).toContainText('not an email address');
  await expect(page.getByRole('row', { name: new RegExp(`x-${tag}`) })).toContainText('unknown batch');

  await page.reload();
  await page.getByRole('button', { name: `Revoke invitation for kid-${tag}@demo.test` }).click();
  await expect(page.getByRole('status')).toHaveText('Invitation revoked.');
  await expect(page.getByRole('button', { name: `Revoke invitation for kid-${tag}@demo.test` })).toHaveCount(0);
});

test('teacher sees only the batches and students they teach (AC3.1, T-ISO-03)', async ({ page }) => {
  // teacher3 teaches NEET 2027 Evening only.
  await login(page, DEMO, 'teacher3@demo.test');
  await page.goto(`${DEMO}/batches`);
  await expect(page.getByRole('link', { name: 'NEET 2027 Evening' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'JEE 2027 Morning' })).toHaveCount(0);
  await page.goto(`${DEMO}/people?tab=students`);
  await expect(page.getByRole('heading', { name: 'Students (25)' })).toBeVisible();

  const owner = await signedIn('owner@demo.test');
  const { data: jee } = await owner.from('batches').select('id').eq('name', 'JEE 2027 Morning').single();
  const res = await page.goto(`${DEMO}/batches/${jee!.id}`);
  expect(res?.status()).toBe(404);
  // Teachers cannot invite staff: the form offers students only.
  await page.goto(`${DEMO}/people?tab=invitations`);
  await expect(page.getByRole('combobox', { name: /^Role/ }).locator('option')).toHaveText(['student']);
});

test('student sees only own batch subjects, works at phone width (AC3.1, AC3.4)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DEMO, 'student01@demo.test'); // JEE batch: Physics, Chemistry, Maths
  const subjects = page.getByRole('region', { name: 'My subjects' }).getByRole('heading', { level: 3 });
  await expect(subjects).toHaveText(['Chemistry', 'Maths', 'Physics']);
  await noSeriousA11yIssues(page);

  const biology = await subjectId('demo.localhost', 'Biology');
  expect((await page.goto(`${DEMO}/subjects/${biology}`))?.status()).toBe(404);
  expect((await page.goto(`${DEMO}/dashboard`))?.status()).toBe(404);
  expect((await page.goto(`${DEMO}/people`))?.status()).toBe(404);

  await page.goto(`${DEMO}/home`);
  await page.getByRole('link', { name: /Physics/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Physics');
  await expect(page.getByRole('tabpanel', { name: 'AI tutor' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Sources' })).toBeHidden();
  await page.getByRole('tab', { name: 'Sources' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'AI tutor' })).toBeHidden();
  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(375);
  await noSeriousA11yIssues(page);
});

test('tenant pages are never cached and differ per tenant (AC3.2, T-SEC-05)', async ({ page, browser }) => {
  await login(page, DEMO, 'student01@demo.test');
  const res = await page.goto(`${DEMO}/home`);
  const cacheControl = res?.headers()['cache-control'] ?? '';
  expect(cacheControl).toContain('no-store');
  expect(cacheControl).toContain('private');
  const demoHeading = await page.getByRole('heading', { level: 1 }).textContent();

  const other = await browser.newPage();
  await login(other, RIVAL, 'student01@rival.test');
  await other.goto(`${RIVAL}/home`);
  await expect(other.locator('.side')).toContainText('Rival Academy');
  await expect(other.locator('.side')).not.toContainText('Demo Classes');
  expect(await other.getByRole('heading', { level: 1 }).textContent()).not.toBe(demoHeading);
  await other.close();
});

test('cross-tenant ids and hosts lead nowhere (T-E2E-ISO-01)', async ({ page }) => {
  const demoPhysics = await subjectId('demo.localhost', 'Physics');
  await login(page, RIVAL, 'owner@rival.test');
  expect((await page.goto(`${RIVAL}/subjects/${demoPhysics}`))?.status()).toBe(404);
  const owner = await signedIn('owner@demo.test');
  const { data: batch } = await owner.from('batches').select('id').eq('name', 'JEE 2027 Morning').single();
  expect((await page.goto(`${RIVAL}/batches/${batch!.id}`))?.status()).toBe(404);
  // The platform area exists only on the admin host.
  expect((await page.goto(`${RIVAL}/platform`))?.status()).toBe(404);
  expect((await page.goto(`${DEMO}/platform/institutes`))?.status()).toBe(404);
  // A member of Rival opening Demo Classes pages is sent to the (signed-out) institute home.
  await page.goto(`${DEMO}/dashboard`);
  await expect(page).toHaveURL(`${DEMO}/`);
});

test('platform admin needs MFA, then manages institutes (AC2.7, Phase 3 platform)', async ({ page }) => {
  const tag = Date.now().toString(36);
  const email = `root-${tag}@examedge.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  expect(error).toBeNull();
  await sql(`insert into private.platform_admins (user_id, granted_by) values ($1, 'e2e')`, [data.user!.id]);

  await page.goto(`${ADMIN}/`);
  await demoSignIn(page, email);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Two-factor sign-in');
  // Without MFA the database shows nothing, even through the API.
  const aal1 = await signedIn(email);
  expect((await aal1.from('institutes').select('id')).data).toEqual([]);

  await page.getByRole('button', { name: 'Set up authenticator' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!;
  await page.getByLabel('6-digit code from your authenticator app').fill(totp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Institutes');
  await expect(page.getByRole('link', { name: 'Demo Classes' })).toBeVisible();
  await noSeriousA11yIssues(page);

  await page.getByLabel('Institute name').fill(`Gamma ${tag}`);
  await page.getByLabel('Web address (subdomain)').fill(`gamma-${tag}`);
  await page.getByLabel('Owner email').fill(`owner-${tag}@gamma.test`);
  await page.getByRole('button', { name: 'Create institute' }).click();
  await expect(page.getByLabel('Owner invitation link')).toHaveValue(
    new RegExp(`^http://gamma-${tag}\\.localhost:3000/invite/[0-9a-f]{64}$`),
  );
  await page.getByLabel('Web address (subdomain)').fill('admin');
  await page.getByRole('button', { name: 'Create institute' }).click();
  await expect(page.getByRole('alert')).toHaveText('That address is reserved.');

  await page.reload();
  await page.getByRole('link', { name: `Gamma ${tag}` }).click();
  await page.getByRole('combobox', { name: /^Status/ }).selectOption('suspended');
  await page.getByRole('button', { name: 'Save institute' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.getByLabel('Doubts per student per day').fill('25');
  await page.getByRole('button', { name: 'Save limits' }).click();
  await expect(page.getByLabel('Doubts per student per day')).toHaveValue('25');

  const res = await page.goto(`http://gamma-${tag}.localhost:3000/`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText('This institute is currently suspended.')).toBeVisible();
});
