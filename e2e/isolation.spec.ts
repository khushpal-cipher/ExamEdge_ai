// T-E2E-ISO-01, T-SEC-04, AC2.4/AC2.5 end to end. Needs `npm run seed:demo` (Demo Classes + Rival Academy).
import { expect, test } from '@playwright/test';
import { demoSignIn, env, instituteId, signedIn } from './helpers';

test('unknown host is a 404 and never shows an institute (T-SEC-04)', async ({ page }) => {
  const res = await page.goto('http://unknown-institute.localhost:3000/');
  expect(res?.status()).toBe(404);
});

test('a Demo Classes student is not a member of Rival Academy (T-E2E-ISO-01)', async ({ page }) => {
  await page.goto('http://demo.localhost:3000/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Classes');
  await demoSignIn(page, 'student01@demo.test');
  await expect(page).toHaveURL('http://demo.localhost:3000/home');

  // Session cookies are host-only: the other subdomain starts signed out.
  await page.goto('http://rival.localhost:3000/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rival Academy');
  await demoSignIn(page, 'student01@demo.test');
  await expect(page.getByText('You are not a member of this institute.')).toBeVisible();
});

test('raw REST calls with a Demo token cannot read or write Rival rows (T-E2E-ISO-01, AC2.5)', async () => {
  const rival = await instituteId('rival.localhost');
  const owner = await signedIn('owner@demo.test');
  for (const table of ['batches', 'subjects', 'chapters', 'memberships', 'invitations', 'audit_events']) {
    const { data, error } = await owner.from(table).select('institute_id').eq('institute_id', rival);
    expect(error, table).toBeNull();
    expect(data, table).toEqual([]);
  }
  const { error: insertError } = await owner.from('batches').insert({ institute_id: rival, name: 'Forged' });
  expect(insertError?.code).toBe('42501');
  const { error: rpcError } = await owner.rpc('create_invitation', {
    inst: rival,
    invite_email: 'x@rival.test',
    invite_role: 'student',
  });
  expect(rpcError?.code).toBe('42501');
});

test('private schema is not exposed through the Data API', async () => {
  const res = await fetch(`${env.API_URL}/rest/v1/platform_admins`, {
    headers: { apikey: env.PUBLISHABLE_KEY!, 'accept-profile': 'private' },
  });
  expect(res.status).toBeGreaterThanOrEqual(400);
});

test('invitation link: wrong account is rejected, invited account joins once (AC2.4)', async ({ page }) => {
  const demo = await instituteId('demo.localhost');
  // No account yet: the local demo sign-in creates it, like a first Google sign-in.
  const email = `newkid${Date.now()}@demo.test`;
  const owner = await signedIn('owner@demo.test');
  const { data: batch } = await owner.from('batches').select('id').eq('name', 'JEE 2027 Morning').single();
  const { data: token, error: inviteError } = await owner.rpc('create_invitation', {
    inst: demo,
    invite_email: email,
    invite_role: 'student',
    batch: batch!.id,
  });
  expect(inviteError).toBeNull();

  const link = `http://demo.localhost:3000/invite/${token}`;
  await page.goto(link);
  await demoSignIn(page, 'student02@demo.test');
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(/different email address/);

  await page.getByRole('button', { name: 'Use a different account' }).click();
  await expect(page.getByLabel('Demo user email')).toBeVisible();
  await page.goto(link);
  await demoSignIn(page, email);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page).toHaveURL('http://demo.localhost:3000/home');

  await page.goto(link);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(/expired, was revoked or was already used/);
});

test('Continue with Google starts Google sign-in and comes back to the same institute host', async ({ page }) => {
  // Stop at our Supabase authorize step and read where it would send the browser: Google is never contacted
  // (Playwright cannot intercept a redirect target, and CI's placeholder client id would be rejected there).
  let google: URL | undefined;
  await page.route('http://127.0.0.1:54321/auth/v1/authorize**', async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    google = new URL(res.headers()['location'] ?? 'about:blank');
    await route.fulfill({ body: 'stopped before Google' });
  });
  await page.goto('http://demo.localhost:3000/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('stopped before Google')).toBeVisible();
  expect(google?.hostname).toBe('accounts.google.com');
  expect(google?.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:54321/auth/v1/callback');
  const cookies = await page.context().cookies('http://demo.localhost:3000');
  expect(cookies.some((c) => c.name.endsWith('-code-verifier'))).toBe(true);
  // A bad or missing code goes back to the same institute's sign-in, never to another host.
  await page.goto('http://demo.localhost:3000/auth/callback?code=bogus&next=//evil.com');
  await expect(page).toHaveURL('http://demo.localhost:3000/?error=signin');
});
