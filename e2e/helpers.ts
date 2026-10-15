import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { localSupabase } from '../scripts/local-supabase';

export const { env, admin } = localSupabase();

// Fresh connection per call (a pg.Client cannot reconnect, and Playwright may retry a test).
export async function sql(query: string, params: unknown[] = []) {
  const { db } = localSupabase();
  await db.connect();
  try {
    return await db.query(query, params);
  } finally {
    await db.end();
  }
}
export const anonClient = () => createClient(env.API_URL!, env.PUBLISHABLE_KEY!, { auth: { persistSession: false } });

export async function signedIn(email: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

export async function instituteId(host: string) {
  const { data, error } = await anonClient().rpc('resolve_institute', { host }).single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function demoSignIn(page: Page, email: string) {
  await page.getByLabel('Demo user email').fill(email);
  await page.getByRole('button', { name: 'Sign in as demo user' }).click();
}
