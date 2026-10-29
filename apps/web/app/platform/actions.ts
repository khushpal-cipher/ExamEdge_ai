'use server';

// Platform admin Server Functions. They only work on the admin host with an MFA (aal2) session, and the database
// re-checks private.is_platform_admin() (which itself requires aal2) in every policy and RPC (AC2.7, TH-15).
import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { log } from '@examedge/core/log';
import { sendInvites } from '@/lib/email';
import { supabase } from '@/lib/supabase';
import { currentHost, isAdminHost, isUuid, rootHost } from '@/lib/tenant';

async function adminDb() {
  if (!isAdminHost(await currentHost())) notFound();
  return supabase();
}

async function requireAal2() {
  const db = await adminDb();
  const { data } = await db.auth.getClaims();
  if (data?.claims.aal !== 'aal2') redirect('/');
  return db;
}

export type EnrollState = { factorId: string; qr: string; secret: string } | { error: string } | null;

export async function enrollTotp(): Promise<EnrollState> {
  const db = await adminDb();
  const { data: factors } = await db.auth.mfa.listFactors();
  // Drop abandoned, never-verified enrolments so they do not pile up against max_enrolled_factors.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await db.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ExamEdge ${Date.now()}` });
  if (error) return { error: 'Could not start authenticator setup. Sign in again and retry.' };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(form: FormData) {
  const db = await adminDb();
  const factorId = String(form.get('factor_id') ?? '');
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code });
  redirect(error ? '/?error=code' : '/');
}

export type CreateState = { link: string; emailed: boolean } | { error: string } | null;
const CREATE_ERRORS: Record<string, string> = {
  slug_reserved: 'That address is reserved.',
  slug_invalid: 'The address must be 3–40 characters: lowercase letters, digits or hyphens.',
  host_mismatch: 'The address must be 3–40 characters: lowercase letters, digits or hyphens.',
  pilot_end_past: 'The pilot end date cannot be in the past.',
};

// Blank or malformed → null (the database then uses its default or clears the value).
const intOrNull = (v: FormDataEntryValue | null) => (v && /^\d+$/.test(String(v)) ? Number(v) : null);
const dateOrNull = (v: FormDataEntryValue | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);

export async function createInstitute(_prev: CreateState, form: FormData): Promise<CreateState> {
  const db = await requireAal2();
  const slug = String(form.get('slug') ?? '')
    .trim()
    .toLowerCase();
  const host = `${slug}.${rootHost()}`;
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('owner_email') ?? '')
    .trim()
    .toLowerCase();
  const { data: token, error } = await db.rpc('create_institute', {
    new_slug: slug,
    new_name: name,
    new_host: host,
    owner_email: email,
    students: intOrNull(form.get('students')),
    ends: dateOrNull(form.get('ends')),
  });
  if (error) {
    if (error.code === '23505') return { error: 'That address or name is already taken.' };
    if (error.code === '23514') return { error: 'Please check the name and owner email.' };
    if (CREATE_ERRORS[error.message]) return { error: CREATE_ERRORS[error.message]! };
    log.error('platform.create_institute_failed', { code: error.code });
    return { error: 'Could not create the institute.' };
  }
  const link = await inviteLink(host, token);
  const sent = await sendInvites(name, [{ email, link, role: 'owner' }]);
  refresh(); // show the new institute in the list without losing the one-time link in the form state
  return { link, emailed: sent.has(email) };
}

// Same scheme and port as the admin host the founder is using.
async function inviteLink(host: string, token: string) {
  const origin = new URL((await headers()).get('origin') ?? `https://admin.${rootHost()}`);
  origin.hostname = host;
  return `${origin.origin}/invite/${token}`;
}

// New owner invitation (wrong email, lost or expired link): the RPC revokes the old pending owner links and is
// refused once an owner has joined (ADR-036).
export async function reinviteOwner(_prev: CreateState, form: FormData): Promise<CreateState> {
  const db = await requireAal2();
  const id = form.get('institute_id');
  if (!isUuid(id)) notFound();
  const email = String(form.get('owner_email') ?? '')
    .trim()
    .toLowerCase();
  const { data: token, error } = await db.rpc('reinvite_owner', { inst: id, owner_email: email });
  if (error) {
    if (error.message === 'has_owner')
      return { error: 'The owner has already joined, so no new invitation is needed.' };
    if (error.code === '23514') return { error: 'Please check the owner email.' };
    if (error.code === '23505') return { error: 'That email already has a pending invitation to this institute.' };
    log.error('platform.reinvite_owner_failed', { code: error.code });
    return { error: 'Could not send a new invitation.' };
  }
  const { data: inst } = await db.from('institutes').select('slug, name').eq('id', id).single();
  const link = await inviteLink(`${inst!.slug}.${rootHost()}`, token);
  const sent = await sendInvites(inst!.name, [{ email, link, role: 'owner' }]);
  return { link, emailed: sent.has(email) };
}

const STATUSES = ['pilot', 'active', 'suspended', 'offboarding'];

export async function updateInstitute(form: FormData) {
  const db = await requireAal2();
  const id = form.get('institute_id');
  if (!isUuid(id)) notFound();
  const status = String(form.get('status') ?? '');
  const color = String(form.get('color') ?? '').toLowerCase();
  const { data: inst } = await db.from('institutes').select('branding').eq('id', id).maybeSingle();
  const { logo } = (inst?.branding ?? {}) as { logo?: string };
  const { error } = await db
    .from('institutes')
    .update({
      name: String(form.get('name') ?? '').trim(),
      status: STATUSES.includes(status) ? status : 'pilot',
      pilot_end: dateOrNull(form.get('pilot_end')),
      expected_students: intOrNull(form.get('expected_students')),
      branding: { ...(/^#[0-9a-f]{6}$/.test(color) && { color }), ...(logo && { logo }) },
    })
    .eq('id', id);
  redirect(`/institutes/${id}?${error ? 'error=invalid' : 'ok=saved'}`);
}

// Only institutes nobody has joined yet (the RPC refuses otherwise); the founder types the address to confirm.
export async function deleteInstitute(form: FormData) {
  const db = await requireAal2();
  const id = form.get('institute_id');
  if (!isUuid(id)) notFound();
  const { error } = await db.rpc('delete_institute', {
    inst: id,
    confirm_slug: String(form.get('confirm_slug') ?? ''),
  });
  if (!error) redirect('/');
  const code = ['has_members', 'confirm_mismatch'].includes(error.message) ? error.message : 'invalid';
  if (code === 'invalid') log.error('platform.delete_institute_failed', { code: error.code });
  redirect(`/institutes/${id}?error=${code}`);
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX = 500 * 1024; // under the 1 MB Server Action body limit; the bucket caps at 1 MiB

// Logos are public files (bucket `logos`), written only by an aal2 platform admin (storage policy).
// shortcut: a replaced logo stays in the bucket; purge orphans with the Phase 10 retention job.
export async function uploadLogo(form: FormData) {
  const db = await requireAal2();
  const id = form.get('institute_id');
  if (!isUuid(id)) notFound();
  const file = form.get('logo');
  if (!(file instanceof File) || !LOGO_TYPES.includes(file.type) || !file.size || file.size > LOGO_MAX)
    redirect(`/institutes/${id}?error=logo`);
  const path = `${id}/${randomUUID()}`;
  const { error: uploadError } = await db.storage.from('logos').upload(path, file, { contentType: file.type });
  if (uploadError) redirect(`/institutes/${id}?error=logo`);
  const { data: inst } = await db.from('institutes').select('branding').eq('id', id).maybeSingle();
  const { error } = await db
    .from('institutes')
    .update({ branding: { ...(inst?.branding as object), logo: path } })
    .eq('id', id);
  redirect(`/institutes/${id}?${error ? 'error=logo' : 'ok=saved'}`);
}

const QUOTA_FIELDS = ['student_daily_messages', 'student_daily_generations', 'max_concurrent_jobs'] as const;

export async function updateQuotas(form: FormData) {
  const db = await requireAal2();
  const id = form.get('institute_id');
  if (!isUuid(id)) notFound();
  const int = (k: string) => Math.trunc(Number(form.get(k)));
  const row: Record<string, number | boolean | string> = {
    monthly_ai_budget_micro_usd: Math.round(Number(form.get('monthly_budget_usd')) * 1_000_000),
    max_upload_bytes: int('max_upload_mb') * 1024 * 1024,
    max_storage_bytes: int('max_storage_gb') * 1024 * 1024 * 1024,
    hard_stop: form.get('hard_stop') === 'on',
    ai_enabled: form.get('ai_enabled') === 'on',
    updated_at: new Date().toISOString(),
  };
  for (const k of QUOTA_FIELDS) row[k] = int(k);
  const seats = { max_students: intOrNull(form.get('max_students')), max_staff: intOrNull(form.get('max_staff')) };
  if (Object.values(row).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
    redirect(`/institutes/${id}?error=invalid`);
  }
  const { error } = await db
    .from('institute_quotas')
    .update({ ...row, ...seats })
    .eq('institute_id', id);
  redirect(`/institutes/${id}?${error ? 'error=invalid' : 'ok=saved'}`);
}

// Platform-wide AI kill switch (AC5.4): every reservation checks it, so it applies to the next AI call everywhere.
export async function setGlobalAi(form: FormData) {
  const db = await requireAal2();
  const { error } = await db.rpc('set_ai_enabled', { enabled: form.get('enabled') === 'true' });
  if (error) log.error('platform.set_ai_enabled_failed', { code: error.code });
  redirect(error ? '/?error=ai' : '/');
}

// ₹ per US$ for every institute's monthly bill (ADR-041 part 2); the database checks MFA and that it is above 0.
export async function setInrRate(form: FormData) {
  const db = await requireAal2();
  const rate = Number(form.get('rate'));
  const { error } = Number.isFinite(rate) ? await db.rpc('set_inr_per_usd', { rate }) : { error: { code: '22P02' } };
  if (error) log.error('platform.set_inr_per_usd_failed', { code: error.code });
  redirect(error ? '/?error=rate' : '/');
}

// Payments by UPI (LAUNCH_PLAN step 7): the founder matches the UTR and amount in the bank app, then approves or
// rejects. The database checks MFA, that the payment waits with a UTR, and (on reject) that a reason is given.
export async function approvePayment(form: FormData) {
  const db = await requireAal2();
  const pay = String(form.get('pay') ?? '');
  const { error } = isUuid(pay) ? await db.rpc('approve_payment', { pay }) : { error: { code: '22P02' } };
  if (error) log.error('platform.approve_payment_failed', { code: error.code });
  redirect(error ? '/?error=payment' : '/');
}

export async function rejectPayment(form: FormData) {
  const db = await requireAal2();
  const pay = String(form.get('pay') ?? '');
  const reason = String(form.get('reason') ?? '').slice(0, 300);
  const { error } = isUuid(pay) ? await db.rpc('reject_payment', { pay, reason }) : { error: { code: '22P02' } };
  if (error) log.error('platform.reject_payment_failed', { code: error.code });
  redirect(error ? '/?error=payment' : '/');
}

// GST number (15 characters). Without it no GST is added to payments (plan-review fix 1); empty clears it.
export async function setGst(form: FormData) {
  const db = await requireAal2();
  const { error } = await db.rpc('set_gst_number', { num: String(form.get('gst') ?? '').slice(0, 15) });
  if (error) log.error('platform.set_gst_failed', { code: error.code });
  redirect(error ? '/?error=gst' : '/');
}
