'use server';

// Staff Server Functions. Each one re-derives the institute from the host and re-checks the caller's role
// (requireMember); RLS then enforces the same rules again in the database. Ids from forms are only ever used
// together with that server-side institute id.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { log } from '@examedge/core/log';
import { currentHost, hostname, isUuid, MANAGERS, requireMember, STAFF } from '@/lib/tenant';

const text = (form: FormData, key: string, max = 120) =>
  String(form.get(key) ?? '')
    .trim()
    .slice(0, max);

function done(path: string, error?: { code?: string; message?: string } | null, okCode = 'saved'): never {
  if (error) {
    // 42501 = RLS/guard denied, 23505 = duplicate name, 23514 = check failed.
    const code = { '42501': 'denied', '23505': 'duplicate', '23514': 'invalid' }[error.code ?? ''] ?? 'failed';
    if (code === 'failed') log.error('staff.action_failed', { path, code: error.code });
    redirect(`${path}?error=${code}`);
  }
  redirect(`${path}?ok=${okCode}`);
}

// ---------------------------------------------------------------- batches
export async function createBatch(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const name = text(form, 'name');
  if (!name) done('/batches', { code: '23514' });
  const exam = text(form, 'exam_id');
  const { error } = await db.from('batches').insert({
    institute_id: institute.id,
    name,
    academic_year: text(form, 'academic_year', 20),
    exam_id: isUuid(exam) ? exam : null,
  });
  done('/batches', error);
}

export async function setBatchArchived(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const id = form.get('batch_id');
  if (!isUuid(id)) done('/batches', { code: '23514' });
  const { error } = await db
    .from('batches')
    .update({ archived_at: form.get('archive') === '1' ? new Date().toISOString() : null })
    .eq('institute_id', institute.id)
    .eq('id', id);
  done(`/batches/${id}`, error);
}

export async function setBatchSubjects(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const id = form.get('batch_id');
  if (!isUuid(id)) done('/batches', { code: '23514' });
  const wanted = new Set(form.getAll('subject_id').filter(isUuid));
  const { data: current, error: readError } = await db
    .from('batch_subjects')
    .select('subject_id')
    .eq('institute_id', institute.id)
    .eq('batch_id', id);
  if (readError) done(`/batches/${id}`, readError);
  const have = new Set(current!.map((r) => r.subject_id as string));
  const add = [...wanted].filter((s) => !have.has(s));
  const remove = [...have].filter((s) => !wanted.has(s));
  if (add.length) {
    const rows = add.map((subject_id) => ({ institute_id: institute.id, batch_id: id, subject_id }));
    const { error } = await db.from('batch_subjects').insert(rows);
    if (error) done(`/batches/${id}`, error);
  }
  if (remove.length) {
    const { error } = await db
      .from('batch_subjects')
      .delete()
      .eq('institute_id', institute.id)
      .eq('batch_id', id)
      .in('subject_id', remove);
    if (error) done(`/batches/${id}`, error);
  }
  done(`/batches/${id}`, null);
}

export async function addBatchMember(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const batch = form.get('batch_id');
  const membership = form.get('membership_id');
  if (!isUuid(batch) || !isUuid(membership)) done('/batches', { code: '23514' });
  const { data: m } = await db
    .from('memberships')
    .select('role')
    .eq('institute_id', institute.id)
    .eq('id', membership)
    .maybeSingle();
  if (!m) done(`/batches/${batch}`, { code: '42501' });
  const { error } = await db.from('batch_members').insert({
    institute_id: institute.id,
    batch_id: batch,
    membership_id: membership,
    batch_role: m.role === 'student' ? 'student' : 'teacher',
  });
  done(`/batches/${batch}`, error);
}

export async function removeBatchMember(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const batch = form.get('batch_id');
  const membership = form.get('membership_id');
  if (!isUuid(batch) || !isUuid(membership)) done('/batches', { code: '23514' });
  const { error } = await db
    .from('batch_members')
    .delete()
    .eq('institute_id', institute.id)
    .eq('batch_id', batch)
    .eq('membership_id', membership);
  done(`/batches/${batch}`, error);
}

// ---------------------------------------------------------------- subjects and chapters
export async function createSubject(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const name = text(form, 'name');
  if (!name) done('/subjects', { code: '23514' });
  const { error } = await db.from('subjects').insert({ institute_id: institute.id, name });
  done('/subjects', error);
}

export async function addChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const subject = form.get('subject_id');
  const name = text(form, 'name', 200);
  if (!isUuid(subject) || !name) done('/subjects', { code: '23514' });
  const { data: last } = await db
    .from('chapters')
    .select('position')
    .eq('institute_id', institute.id)
    .eq('subject_id', subject)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db
    .from('chapters')
    .insert({ institute_id: institute.id, subject_id: subject, name, position: (last?.position ?? 0) + 1 });
  done('/subjects', error);
}

export async function renameChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  const name = text(form, 'name', 200);
  if (!isUuid(id) || !name) done('/subjects', { code: '23514' });
  const { error } = await db.from('chapters').update({ name }).eq('institute_id', institute.id).eq('id', id);
  done('/subjects', error);
}

// Swaps positions with the neighbour above/below within the same subject.
export async function moveChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  if (!isUuid(id)) done('/subjects', { code: '23514' });
  const { data: me } = await db
    .from('chapters')
    .select('subject_id, position')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!me) done('/subjects', { code: '42501' });
  const up = form.get('dir') === 'up';
  const { data: other } = await db
    .from('chapters')
    .select('id, position')
    .eq('institute_id', institute.id)
    .eq('subject_id', me.subject_id)
    [up ? 'lt' : 'gt']('position', me.position)
    .order('position', { ascending: !up })
    .limit(1)
    .maybeSingle();
  if (!other) done('/subjects', null);
  const a = await db
    .from('chapters')
    .update({ position: other.position })
    .eq('institute_id', institute.id)
    .eq('id', id);
  if (a.error) done('/subjects', a.error);
  const b = await db
    .from('chapters')
    .update({ position: me.position })
    .eq('institute_id', institute.id)
    .eq('id', other.id);
  done('/subjects', b.error);
}

export async function deleteChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  if (!isUuid(id)) done('/subjects', { code: '23514' });
  const { error } = await db.from('chapters').delete().eq('institute_id', institute.id).eq('id', id);
  done('/subjects', error, 'deleted');
}

// ---------------------------------------------------------------- people
export async function updateMembership(form: FormData) {
  const { institute, member, db } = await requireMember(MANAGERS);
  const id = form.get('membership_id');
  const role = text(form, 'role');
  const status = text(form, 'status');
  if (!isUuid(id) || id === member.id) done('/people', { code: '23514' });
  const { error } = await db.from('memberships').update({ role, status }).eq('institute_id', institute.id).eq('id', id);
  done('/people', error);
}

export async function revokeInvitation(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('invitation_id');
  if (!isUuid(id)) done('/people', { code: '23514' });
  const { error } = await db
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('institute_id', institute.id)
    .eq('id', id)
    .is('accepted_at', null);
  done('/people?tab=invitations', error, 'revoked');
}

export type InviteResult = { email: string; link?: string; error?: string };
export type InviteState = { results: InviteResult[] } | null;

const ROLES = ['owner', 'admin', 'teacher', 'student'];
const EMAIL = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;
const INVITE_ERRORS: Record<string, string> = {
  '42501': 'not allowed to invite this role',
  '23505': 'already invited',
  '23514': 'invalid',
};

// Single invite or a CSV list (one per line: email[,role[,batch name]]). Emails are BLOCKED (ADR-020), so each
// link is returned once to the person who created it; only its hash is stored.
export async function createInvitations(_prev: InviteState, form: FormData): Promise<InviteState> {
  const { institute, db } = await requireMember(STAFF);
  const defaultRole = ROLES.includes(text(form, 'role')) ? text(form, 'role') : 'student';
  const defaultBatch = isUuid(form.get('batch_id')) ? (form.get('batch_id') as string) : null;
  const file = form.get('file');
  const csv = [String(form.get('csv') ?? ''), file instanceof File && file.size ? await file.text() : ''].join('\n');
  const single = text(form, 'email', 254);
  const lines = (single ? [single] : csv.split(/\r?\n/))
    .map((l) => l.trim())
    .filter((l) => l && !/^email\b/i.test(l))
    .slice(0, 500);
  if (!lines.length) return { results: [{ email: '', error: 'no email addresses given' }] };

  const { data: batches } = await db.from('batches').select('id, name').eq('institute_id', institute.id);
  const batchByName = new Map((batches ?? []).map((b) => [b.name.toLowerCase(), b.id as string]));
  const h = await headers();
  const origin = h.get('origin') ?? '';
  const host = await currentHost();
  const base =
    hostname(origin.replace(/^https?:\/\//, '')) === host
      ? origin
      : `${host.endsWith('localhost') ? 'http' : 'https'}://${host}`;

  const results: InviteResult[] = [];
  for (const line of lines) {
    const [rawEmail = '', rawRole = '', rawBatch = ''] = line.split(',').map((c) => c.trim());
    const email = rawEmail.toLowerCase();
    const role = rawRole ? rawRole.toLowerCase() : defaultRole;
    const batch = rawBatch ? batchByName.get(rawBatch.toLowerCase()) : defaultBatch;
    if (!EMAIL.test(email)) results.push({ email, error: 'not an email address' });
    else if (!ROLES.includes(role)) results.push({ email, error: 'unknown role' });
    else if (rawBatch && !batch) results.push({ email, error: 'unknown batch' });
    else {
      const { data: token, error } = await db.rpc('create_invitation', {
        inst: institute.id,
        invite_email: email,
        invite_role: role,
        batch: role === 'teacher' || role === 'student' ? batch : null,
      });
      if (error) results.push({ email, error: INVITE_ERRORS[error.code ?? ''] ?? 'failed' });
      else results.push({ email, link: `${base}/invite/${token}` });
    }
  }
  revalidatePath('/people');
  return { results };
}
