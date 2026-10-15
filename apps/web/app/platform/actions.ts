'use server';

// Platform admin Server Functions. They only work on the admin host with an MFA (aal2) session, and the database
// re-checks private.is_platform_admin() (which itself requires aal2) in every policy and RPC (AC2.7, TH-15).
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { log } from '@examedge/core/log';
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

export type CreateState = { link: string } | { error: string } | null;
const CREATE_ERRORS: Record<string, string> = {
  slug_reserved: 'That address is reserved.',
  slug_invalid: 'Use 3–40 lowercase letters, digits or hyphens.',
  host_mismatch: 'Use 3–40 lowercase letters, digits or hyphens.',
};

export async function createInstitute(_prev: CreateState, form: FormData): Promise<CreateState> {
  const db = await requireAal2();
  const slug = String(form.get('slug') ?? '')
    .trim()
    .toLowerCase();
  const host = `${slug}.${rootHost()}`;
  const { data: token, error } = await db.rpc('create_institute', {
    new_slug: slug,
    new_name: String(form.get('name') ?? '').trim(),
    new_host: host,
    owner_email: String(form.get('owner_email') ?? '').trim(),
  });
  if (error) {
    if (error.code === '23505') return { error: 'That address or name is already taken.' };
    if (error.code === '23514') return { error: 'Please check the name and owner email.' };
    if (CREATE_ERRORS[error.message]) return { error: CREATE_ERRORS[error.message]! };
    log.error('platform.create_institute_failed', { code: error.code });
    return { error: 'Could not create the institute.' };
  }
  // Same scheme and port as the admin host the founder is using.
  const origin = new URL((await headers()).get('origin') ?? `https://admin.${rootHost()}`);
  origin.hostname = host;
  return { link: `${origin.origin}/invite/${token}` };
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
      branding: { ...(/^#[0-9a-f]{6}$/.test(color) && { color }), ...(logo && { logo }) },
    })
    .eq('id', id);
  redirect(`/institutes/${id}?${error ? 'error=invalid' : 'ok=saved'}`);
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

const QUOTA_FIELDS = [
  'student_daily_messages',
  'student_daily_premium_messages',
  'student_daily_generations',
  'max_concurrent_jobs',
] as const;

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
    updated_at: new Date().toISOString(),
  };
  for (const k of QUOTA_FIELDS) row[k] = int(k);
  if (Object.values(row).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
    redirect(`/institutes/${id}?error=invalid`);
  }
  const { error } = await db.from('institute_quotas').update(row).eq('institute_id', id);
  redirect(`/institutes/${id}?${error ? 'error=invalid' : 'ok=saved'}`);
}
