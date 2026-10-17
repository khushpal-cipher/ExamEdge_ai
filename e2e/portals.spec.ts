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
// 1×1 transparent PNG
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a80000000049454e44ae426082',
  'hex',
);

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
    .limit(1) // names repeat per batch (ADR-038); any copy proves the point
    .single();
  return data!.id as string;
}

test('owner sets up a batch with its subjects, a topic and invitations (AC3.1)', async ({ page }) => {
  const tag = Date.now().toString(36);
  await login(page, DEMO, 'owner@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await noSeriousA11yIssues(page);

  // Subjects are typed while creating the batch (ADR-038); more can be added on the batch page.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Batches' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Batches');
  await page.getByLabel('Name', { exact: true }).fill(`Commerce ${tag}`);
  await page.getByLabel('Academic year', { exact: true }).fill('2026-27');
  await page.getByLabel('Subjects', { exact: true }).fill(`Economics ${tag}, Accounts ${tag}`);
  await page.getByRole('button', { name: 'Create batch' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Commerce ${tag}`);
  await page.getByLabel('New subject').fill(`Business ${tag}`);
  await page.getByRole('button', { name: 'Add subject' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  const subjects = page.getByRole('region', { name: 'Subjects' });
  await expect(subjects.getByRole('link')).toHaveText([`Accounts ${tag}`, `Business ${tag}`, `Economics ${tag}`]);

  await subjects.getByRole('link', { name: `Economics ${tag}` }).click();
  await page.getByLabel('New topic').fill('Demand and Supply');
  await page.getByRole('button', { name: 'Add topic' }).click();
  await expect(page.getByLabel('Topic name')).toHaveValue('Demand and Supply');
  await page.getByRole('link', { name: 'Demand and Supply' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demand and Supply');
  await page.getByLabel('New subtopic').fill('Elasticity');
  await page.getByRole('button', { name: 'Add subtopic' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Elasticity' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Subtopics' }).getByText('Upload notes')).toBeVisible();

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
  await page
    .getByRole('region', { name: 'My subjects' })
    .getByRole('link', { name: /Physics/ })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Physics');
  await page.getByRole('link', { name: 'Rotational Motion' }).click();
  // The topic page opens on its notes; Smart Study is the other tab (ADR-038).
  await expect(page.getByRole('tabpanel', { name: 'Subtopics' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Smart Study' })).toBeHidden();
  await page.getByRole('tab', { name: 'Smart Study' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Smart Study' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Subtopics' })).toBeHidden();
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
  await expect(page.getByRole('button', { name: 'Turn AI off for everyone' })).toBeVisible();
  await noSeriousA11yIssues(page);

  await page.getByLabel('Institute name').fill(`Gamma ${tag}`);
  await page.getByLabel('Web address (subdomain)').fill(`gamma-${tag}`);
  await page.getByLabel('Owner email').fill(`owner-${tag}@gamma.test`);
  await page.getByRole('button', { name: 'Create institute' }).click();
  await expect(page.getByLabel('Owner invitation link')).toHaveValue(
    new RegExp(`^http://gamma-${tag}\\.localhost:3000/invite/[0-9a-f]{64}$`),
  );
  await expect(page.getByRole('link', { name: `Gamma ${tag}` })).toBeVisible(); // list updates without a reload
  // React resets the form after a successful action, so fill every field again.
  await page.getByLabel('Institute name').fill(`Delta ${tag}`);
  await page.getByLabel('Web address (subdomain)').fill('admin');
  await page.getByLabel('Owner email').fill(`owner-${tag}@delta.test`);
  await page.getByRole('button', { name: 'Create institute' }).click();
  // Scoped to our alert: Next's route announcer is also role=alert.
  await expect(page.locator('form').getByRole('alert')).toHaveText('That address is reserved.');

  await page.reload();
  await page.getByRole('link', { name: `Gamma ${tag}` }).click();
  await page.getByRole('combobox', { name: /^Status/ }).selectOption('suspended');
  await page.getByRole('button', { name: 'Save institute' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await expect(page.getByText(/^AI spent this month: \$0\.00 of \$20\.00$/)).toBeVisible();
  await page.getByLabel('Doubts per student per day').fill('25');
  // AI off for this institute only (never the global switch here: other specs run the worker in parallel).
  await page.getByLabel('AI enabled').uncheck();
  // Wait for the save to finish, then reload: proves it persisted and no redirect is still in flight for the next form.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save limits' }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel('Doubts per student per day')).toHaveValue('25');
  await expect(page.getByLabel('AI enabled')).not.toBeChecked();
  const { rows: ai } = await sql(
    `select i.slug, q.ai_enabled from public.institute_quotas q join public.institutes i on i.id = q.institute_id
     where i.slug in ('demo', $1) order by i.slug`,
    [`gamma-${tag}`],
  );
  expect(ai).toEqual([
    { slug: 'demo', ai_enabled: true },
    { slug: `gamma-${tag}`, ai_enabled: false },
  ]);

  // Logo: wrong type refused, PNG stored in the public bucket, kept when the institute form is saved again.
  const logoInput = page.getByLabel(/^Logo \(/);
  await logoInput.setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.getByRole('button', { name: 'Upload logo' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('Choose a PNG, JPG or WebP logo up to 500 KB.');
  await logoInput.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Upload logo' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  const logo = page.getByRole('img', { name: `Gamma ${tag} logo` });
  const src = (await logo.getAttribute('src'))!;
  expect((await page.request.get(src)).status()).toBe(200);
  await page.getByRole('button', { name: 'Save institute' }).click();
  await expect(page.getByRole('img', { name: `Gamma ${tag} logo` })).toHaveAttribute('src', src);

  const res = await page.goto(`http://gamma-${tag}.localhost:3000/`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText('This institute is currently suspended.')).toBeVisible();

  // Delete: refused for an institute people joined and for a wrong confirmation; works for Gamma (nobody joined).
  await page.goto(`${ADMIN}/`);
  await page.getByRole('link', { name: 'Demo Classes' }).click();
  // New owner invitation: refused once the owner joined; for Gamma it replaces the old link (ADR-036).
  // Wait for the page: the list page's create form has an "Owner email" field too.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Classes');
  await page.getByLabel('Owner email').fill(`new-${tag}@demo.test`);
  await page.getByRole('button', { name: 'Send new owner invitation' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('already joined');
  await page.getByLabel('Type demo to confirm').fill('demo');
  await page.getByRole('button', { name: 'Delete institute' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('people have already joined');
  await page.goto(`${ADMIN}/`);
  await page.getByRole('link', { name: `Gamma ${tag}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Gamma ${tag}`);
  await page.getByLabel('Owner email').fill(`right-${tag}@gamma.test`);
  await page.getByRole('button', { name: 'Send new owner invitation' }).click();
  await expect(page.getByLabel('Owner invitation link')).toHaveValue(
    new RegExp(`^http://gamma-${tag}\\.localhost:3000/invite/[0-9a-f]{64}$`),
  );
  const { rows: invites } = await sql(
    `select v.email, v.revoked_at is not null as revoked from public.invitations v
     join public.institutes i on i.id = v.institute_id where i.slug = $1 order by v.created_at`,
    [`gamma-${tag}`],
  );
  expect(invites).toEqual([
    { email: `owner-${tag}@gamma.test`, revoked: true },
    { email: `right-${tag}@gamma.test`, revoked: false },
  ]);
  await page.getByLabel(`Type gamma-${tag} to confirm`).fill('gamma');
  await page.getByRole('button', { name: 'Delete institute' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('did not match');
  await page.getByLabel(`Type gamma-${tag} to confirm`).fill(`gamma-${tag}`);
  await page.getByRole('button', { name: 'Delete institute' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Institutes');
  await expect(page.getByRole('link', { name: `Gamma ${tag}` })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Demo Classes' })).toBeVisible();
});
