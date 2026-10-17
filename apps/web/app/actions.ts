'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEMO_PASSWORD, demoLoginAllowed, safeNext } from '@examedge/core/demo';
import { log } from '@examedge/core/log';
import { supabase } from '@/lib/supabase';

export async function signInDemo(form: FormData) {
  if (!demoLoginAllowed(process.env)) throw new Error('Demo sign-in is disabled');
  const next = safeNext(form.get('next'));
  const db = await supabase();
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  let { error } = await db.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  // Local stack only: an unknown email gets an account, like a first Google sign-in. Membership still comes only
  // from accepting an invitation, so a new account sees nothing until then.
  if (error?.code === 'invalid_credentials') {
    const { data, error: signUpError } = await db.auth.signUp({ email, password: DEMO_PASSWORD });
    error = signUpError ?? (data.session ? null : error);
  }
  if (error) redirect(`${next}${next.includes('?') ? '&' : '?'}error=signin`);
  redirect(next);
}

// Google via Supabase Auth (PKCE). Google returns to /auth/callback on the same host, so the session cookie stays
// host-only for this institute; `next` brings an invitee back to their invitation.
export async function signInGoogle(form: FormData) {
  const next = safeNext(form.get('next'));
  const origin = (await headers()).get('origin');
  if (!origin) redirect(`/?error=signin`);
  const db = await supabase();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    log.error('auth.google_start_failed', { code: error?.code });
    redirect(`${next}${next.includes('?') ? '&' : '?'}error=signin`);
  }
  redirect(data.url);
}

export async function signOut() {
  await (await supabase()).auth.signOut();
  redirect('/');
}

const INVITE_ERRORS = ['invitation_invalid', 'invitation_not_usable', 'email_mismatch', 'already_member'];

export async function acceptInvite(form: FormData) {
  const token = String(form.get('token') ?? '');
  const db = await supabase();
  const { error } = await db.rpc('accept_invitation', { token });
  if (error) {
    const code = INVITE_ERRORS.find((c) => error.message === c) ?? 'failed';
    if (code === 'failed') log.error('invite.accept_failed', { code: error.code });
    redirect(`/invite/${encodeURIComponent(token)}?error=${code}`);
  }
  redirect('/');
}
