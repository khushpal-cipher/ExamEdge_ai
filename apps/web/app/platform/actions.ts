'use server';

// Platform admin Server Functions. They only work on the admin host with an MFA (aal2) session, and the database
// re-checks private.is_platform_admin() (which itself requires aal2) in every policy and RPC (AC2.7, TH-15).
import { randomUUID } from 'node:crypto';
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AiBlocked, type Meter } from '@examedge/core/ai/gateway';
import { embedLibraryItem } from '@examedge/core/ai/library';
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
};

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
    ai_enabled: form.get('ai_enabled') === 'on',
    updated_at: new Date().toISOString(),
  };
  for (const k of QUOTA_FIELDS) row[k] = int(k);
  if (Object.values(row).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
    redirect(`/institutes/${id}?error=invalid`);
  }
  const { error } = await db.from('institute_quotas').update(row).eq('institute_id', id);
  redirect(`/institutes/${id}?${error ? 'error=invalid' : 'ok=saved'}`);
}

// Platform-wide AI kill switch (AC5.4): every reservation checks it, so it applies to the next AI call everywhere.
export async function setGlobalAi(form: FormData) {
  const db = await requireAal2();
  const { error } = await db.rpc('set_ai_enabled', { enabled: form.get('enabled') === 'true' });
  if (error) log.error('platform.set_ai_enabled_failed', { code: error.code });
  redirect(error ? '/?error=ai' : '/');
}

// ---------------------------------------------------------------- ExamEdge library (ADR-027)
// Writes run as the aal2 platform admin; RLS, the review trigger and the publish RPC enforce the workflow again.
type DbError = { code?: string; message?: string } | null;

function back(path: string, error: DbError, ok = 'saved'): never {
  if (!error) redirect(`${path}?ok=${ok}`);
  const code =
    error.message === 'not_reviewed'
      ? 'not_reviewed'
      : ({ '23505': 'duplicate', '23514': 'invalid', '23502': 'invalid' }[error.code ?? ''] ?? 'failed');
  if (code === 'failed') log.error('platform.library_failed', { path, code: error.code });
  redirect(`${path}?error=${code}`);
}

const field = (form: FormData, key: string, max = 200) =>
  String(form.get(key) ?? '')
    .trim()
    .slice(0, max);
const KINDS = ['explanation', 'formula_sheet', 'worked_example'];

export async function createLibrarySubject(form: FormData) {
  const db = await requireAal2();
  const exam = form.get('exam_id');
  if (!isUuid(exam)) back('/library', { code: '23514' });
  const { data, error } = await db
    .from('library_subjects')
    .insert({ exam_id: exam, name: field(form, 'name', 120) })
    .select('id')
    .single();
  back(error ? '/library' : `/library/${data!.id}`, error);
}

export async function createLibraryChapter(form: FormData) {
  const db = await requireAal2();
  const subject = form.get('subject_id');
  if (!isUuid(subject)) notFound();
  const { count } = await db
    .from('library_chapters')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', subject);
  const { error } = await db
    .from('library_chapters')
    .insert({ subject_id: subject, name: field(form, 'name'), position: (count ?? 0) + 1 });
  back(`/library/${subject}`, error);
}

export async function createLibraryTopic(form: FormData) {
  const db = await requireAal2();
  const [subject, chapter] = [form.get('subject_id'), form.get('chapter_id')];
  if (!isUuid(subject) || !isUuid(chapter)) notFound();
  const { count } = await db
    .from('library_topics')
    .select('id', { count: 'exact', head: true })
    .eq('chapter_id', chapter);
  const { error } = await db
    .from('library_topics')
    .insert({ chapter_id: chapter, name: field(form, 'name'), position: (count ?? 0) + 1 });
  back(`/library/${subject}`, error);
}

// A new item is always a draft by its author (trigger); the reviewer is whoever marks it reviewed.
export async function createLibraryItem(form: FormData) {
  const db = await requireAal2();
  const topic = form.get('topic_id');
  const kind = field(form, 'kind');
  if (!isUuid(topic) || !KINDS.includes(kind)) notFound();
  const { data, error } = await db
    .from('library_items')
    .insert({
      topic_id: topic,
      kind,
      content: { body: field(form, 'body', 20000) },
      provenance: field(form, 'provenance', 1000),
    })
    .select('id')
    .single();
  if (error) back(`/library/topics/${topic}`, error);
  back(`/library/items/${data!.id}`, null);
}

// Saving changed text sends the item back to draft (trigger): it needs a new review before students see it again.
export async function saveLibraryItem(form: FormData) {
  const db = await requireAal2();
  const id = form.get('item_id');
  const kind = field(form, 'kind');
  if (!isUuid(id) || !KINDS.includes(kind)) notFound();
  const { error } = await db
    .from('library_items')
    .update({ kind, content: { body: field(form, 'body', 20000) }, provenance: field(form, 'provenance', 1000) })
    .eq('id', id);
  back(`/library/items/${id}`, error);
}

const STATUS_OK: Record<string, string> = { reviewed: 'reviewed', draft: 'draft', retired: 'retired' };

export async function setLibraryStatus(form: FormData) {
  const db = await requireAal2();
  const id = form.get('item_id');
  const status = field(form, 'status');
  if (!isUuid(id) || !STATUS_OK[status]) notFound();
  const { error } = await db.from('library_items').update({ status }).eq('id', id);
  back(`/library/items/${id}`, error, STATUS_OK[status]);
}

const platformMeter = (db: Awaited<ReturnType<typeof supabase>>): Meter => ({
  reserve: async (feat, prov, mdl, reserve) => {
    const { data, error } = await db.rpc('ai_reserve_platform', { feat, prov, mdl, reserve }).single();
    if (error) throw error;
    const r = data as { record_id: string; blocked: string | null };
    return { id: r.record_id, blocked: r.blocked };
  },
  settle: async (rid, usage, cost, result) => {
    const { error } = await db.rpc('ai_settle_platform', { rid, usage, cost, result });
    if (error) throw error;
  },
});

// Chunk + embed the reviewed text (metered platform call), then swap chunks and publish in one transaction.
export async function publishLibraryItem(form: FormData) {
  const db = await requireAal2();
  const id = form.get('item_id');
  if (!isUuid(id)) notFound();
  const path = `/library/items/${id}`;
  const { data: item } = await db
    .from('library_items')
    .select('status, content, library_topics(name)')
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();
  if (item.status === 'draft') back(path, { message: 'not_reviewed' });
  let embedded;
  try {
    embedded = await embedLibraryItem(
      platformMeter(db),
      (item.library_topics as unknown as { name: string }).name,
      (item.content as { body: string }).body,
    );
  } catch (e) {
    if (e instanceof AiBlocked) redirect(`${path}?error=ai`);
    throw e;
  }
  const { error } = await db.rpc('publish_library_item', {
    item: id,
    chunks: embedded.chunks,
    model: embedded.model,
  });
  back(path, error, 'published');
}
