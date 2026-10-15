// T-E2E-ISO-01, T-SEC-04, AC2.4/AC2.5 end to end. Needs `npm run seed:demo` (Demo Classes + Rival Academy).
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { localSupabase } from '../scripts/local-supabase';

const { env, admin } = localSupabase();
const anonClient = () => createClient(env.API_URL!, env.PUBLISHABLE_KEY!, { auth: { persistSession: false } });

async function signedIn(email: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

async function instituteId(host: string) {
  const { data, error } = await anonClient().rpc('resolve_institute', { host }).single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

async function demoSignIn(page: Page, email: string) {
  await page.getByLabel('Demo user email').fill(email);
  await page.getByRole('button', { name: 'Sign in as demo user' }).click();
}

test('unknown host is a 404 and never shows an institute (T-SEC-04)', async ({ page }) => {
  const res = await page.goto('http://unknown-institute.localhost:3000/');
  expect(res?.status()).toBe(404);
});

test('a Demo Classes student is not a member of Rival Academy (T-E2E-ISO-01)', async ({ page }) => {
  await page.goto('http://demo.localhost:3000/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Classes');
  await demoSignIn(page, 'student01@demo.test');
  await expect(page.getByText('Signed in as student.')).toBeVisible();

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
  const email = `newkid${Date.now()}@demo.test`;
  const { error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  expect(error).toBeNull();
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
  await expect(page.getByText('Signed in as student.')).toBeVisible();

  await page.goto(link);
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(/expired, was revoked or was already used/);
});
