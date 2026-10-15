'use server';

import { redirect } from 'next/navigation';
import { DEMO_PASSWORD, demoLoginAllowed, safeNext } from '@examedge/core/demo';
import { log } from '@examedge/core/log';
import { supabase } from '@/lib/supabase';

export async function signInDemo(form: FormData) {
  if (!demoLoginAllowed(process.env)) throw new Error('Demo sign-in is disabled');
  const next = safeNext(form.get('next'));
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get('email') ?? '')
      .trim()
      .toLowerCase(),
    password: DEMO_PASSWORD,
  });
  if (error) redirect(`${next}${next.includes('?') ? '&' : '?'}error=signin`);
  redirect(next);
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
