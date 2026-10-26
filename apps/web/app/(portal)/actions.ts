'use server';

// Staff Server Functions. Each one re-derives the institute from the host and re-checks the caller's role
// (requireMember); RLS then enforces the same rules again in the database. Ids from forms are only ever used
// together with that server-side institute id.
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { done, text } from './form';
import { sendInvites } from '@/lib/email';
import { BATCH_COOKIE, studentBatches } from '@/lib/student';
import { currentHost, hostname, isUuid, MANAGERS, requireMember, STAFF } from '@/lib/tenant';

// ---------------------------------------------------------------- batches
// The owner types the batch's subjects right there (comma-separated, ADR-038).
export async function createBatch(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const name = text(form, 'name');
  if (!name) done('/batches', { code: '23514' });
  const exam = text(form, 'exam_id');
  const { data, error } = await db
    .from('batches')
    .insert({
      institute_id: institute.id,
      name,
      academic_year: text(form, 'academic_year', 20),
      exam_id: isUuid(exam) ? exam : null,
    })
    .select('id')
    .single();
  if (error) done('/batches', error);
  const subjects = [
    ...new Set(
      text(form, 'subjects', 1000)
        .split(',')
        .map((s) => s.trim().slice(0, 120)),
    ),
  ];
  const rows = subjects.filter(Boolean).map((s) => ({ institute_id: institute.id, batch_id: data.id, name: s }));
  const { error: subjectError } = rows.length ? await db.from('subjects').insert(rows) : { error: null };
  done(`/batches/${data.id}`, subjectError);
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

// Promotion (ADR-040): the old batch row is kept with left_at, so the student still sees their own year.
export async function moveStudents(form: FormData) {
  const { db } = await requireMember(MANAGERS);
  const from = form.get('batch_id');
  const to = form.get('to_batch_id');
  if (!isUuid(from)) done('/batches', { code: '23514' });
  const members = form.getAll('membership_id').filter(isUuid);
  if (!isUuid(to) || !members.length) done(`/batches/${from}`, { code: '23514' });
  const { error } = await db.rpc('move_students', { from_batch: from, to_batch: to, members });
  done(`/batches/${from}`, error, 'moved');
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

// ---------------------------------------------------------------- subjects, topics (table chapters), subtopics
export async function createSubject(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const batch = form.get('batch_id');
  const name = text(form, 'name');
  if (!isUuid(batch)) done('/batches', { code: '23514' });
  if (!name) done(`/batches/${batch}`, { code: '23514' });
  const { error } = await db.from('subjects').insert({ institute_id: institute.id, batch_id: batch, name });
  done(`/batches/${batch}`, error);
}

// Topic forms live on the subject page; the subject id only picks where to go back to.
const subjectPage = (form: FormData) =>
  isUuid(form.get('subject_id')) ? `/subjects/${form.get('subject_id')}` : '/subjects';

export async function addChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const subject = form.get('subject_id');
  const name = text(form, 'name', 200);
  if (!isUuid(subject) || !name) done(subjectPage(form), { code: '23514' });
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
  done(subjectPage(form), error);
}

export async function renameChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  const name = text(form, 'name', 200);
  if (!isUuid(id) || !name) done(subjectPage(form), { code: '23514' });
  const { error } = await db.from('chapters').update({ name }).eq('institute_id', institute.id).eq('id', id);
  done(subjectPage(form), error);
}

// Swaps positions with the neighbour above/below within the same subject.
export async function moveChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  if (!isUuid(id)) done(subjectPage(form), { code: '23514' });
  const { data: me } = await db
    .from('chapters')
    .select('subject_id, position')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!me) done(subjectPage(form), { code: '42501' });
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
  if (!other) done(subjectPage(form), null);
  const a = await db
    .from('chapters')
    .update({ position: other.position })
    .eq('institute_id', institute.id)
    .eq('id', id);
  if (a.error) done(subjectPage(form), a.error);
  const b = await db
    .from('chapters')
    .update({ position: me.position })
    .eq('institute_id', institute.id)
    .eq('id', other.id);
  done(subjectPage(form), b.error);
}

export async function deleteChapter(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('chapter_id');
  if (!isUuid(id)) done(subjectPage(form), { code: '23514' });
  const { error } = await db.from('chapters').delete().eq('institute_id', institute.id).eq('id', id);
  done(subjectPage(form), error, 'deleted');
}

export async function addSubtopic(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const subject = form.get('subject_id');
  const chapter = form.get('chapter_id');
  const name = text(form, 'name', 200);
  if (!isUuid(subject) || !isUuid(chapter)) done('/subjects', { code: '23514' });
  if (!name) done(`/topics/${chapter}`, { code: '23514' });
  const { data: last } = await db
    .from('subtopics')
    .select('position')
    .eq('institute_id', institute.id)
    .eq('chapter_id', chapter)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.from('subtopics').insert({
    institute_id: institute.id,
    subject_id: subject,
    chapter_id: chapter,
    name,
    position: (last?.position ?? 0) + 1,
  });
  done(`/topics/${chapter}`, error);
}

export async function renameSubtopic(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('subtopic_id');
  const chapter = form.get('chapter_id');
  const name = text(form, 'name', 200);
  if (!isUuid(chapter)) done('/subjects', { code: '23514' });
  if (!isUuid(id) || !name) done(`/topics/${chapter}`, { code: '23514' });
  const { error } = await db.from('subtopics').update({ name }).eq('institute_id', institute.id).eq('id', id);
  done(`/topics/${chapter}`, error);
}

// Refused (in_use) while the subtopic still has notes.
export async function deleteSubtopic(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('subtopic_id');
  const chapter = form.get('chapter_id');
  if (!isUuid(chapter)) done('/subjects', { code: '23514' });
  if (!isUuid(id)) done(`/topics/${chapter}`, { code: '23514' });
  const { error } = await db.from('subtopics').delete().eq('institute_id', institute.id).eq('id', id);
  done(`/topics/${chapter}`, error, 'deleted');
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

export type InviteResult = { email: string; link?: string; error?: string; role?: string; emailed?: boolean };
export type InviteState = { results: InviteResult[] } | null;

const ROLES = ['owner', 'admin', 'teacher', 'student'];
const EMAIL = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;
const INVITE_ERRORS: Record<string, string> = {
  '42501': 'not allowed to invite this role',
  '23505': 'already invited',
  '23514': 'invalid',
  seats_full: 'no free seats for this role (remove someone or ask ExamEdge for more)',
  read_only: 'the free pilot has ended',
};

// Single invite or a CSV list (one per line: email[,role[,batch name]]). Each link is emailed (ADR-035) and also
// returned once to the person who created it, as a fallback; only its hash is stored.
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
      if (error)
        results.push({ email, error: INVITE_ERRORS[error.message] ?? INVITE_ERRORS[error.code ?? ''] ?? 'failed' });
      else results.push({ email, link: `${base}/invite/${token}`, role });
    }
  }
  const invites = results.flatMap((r) => (r.link ? [{ email: r.email, link: r.link, role: r.role! }] : []));
  const sent = await sendInvites(institute.name, invites);
  for (const r of results) if (r.link) r.emailed = sent.has(r.email);
  revalidatePath('/people');
  return { results };
}

// ---------------------------------------------------------------- student batch switcher (ADR-040)
export async function chooseBatch(form: FormData) {
  const { list } = await studentBatches(); // requires a student of this institute
  const id = form.get('batch');
  if (typeof id !== 'string' || !list.some((b) => b.id === id)) return;
  (await cookies()).set(BATCH_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 400 * 24 * 3600 });
  // Home of the chosen batch: the page the student was on may belong to the other batch (ADR-043).
  redirect('/home');
}
