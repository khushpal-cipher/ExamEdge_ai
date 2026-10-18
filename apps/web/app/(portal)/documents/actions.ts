'use server';

// Staff Server Functions for notes (Phase 4). Institute from the host, role re-checked, RLS + storage policies decide
// the rest. The file itself never passes through this server: the browser uploads it straight to Storage with a
// signed upload URL that the storage policy allows only for this version's own path (DATABASE_DESIGN §4.3).
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { AiBlocked } from '@examedge/core/ai/gateway';
import { MAX_EXPLANATION, MAX_NOTES, NotesError, writeNotes } from '@examedge/core/ai/notes';
import { log } from '@examedge/core/log';
import { done, text } from '../form';
import { webMeter } from '@/lib/meter';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';

const TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_BYTES = 50 * 1024 * 1024;

type Db = Awaited<ReturnType<typeof requireMember>>['db'];
export type UploadTicket = { error: string } | { documentId: string; versionId: string; signedUrl: string };

// Step 1: create the document (or a new version of an existing one) and a signed upload URL for its file.
export async function startUpload(form: FormData): Promise<UploadTicket> {
  const { institute, db } = await requireMember(STAFF);
  const mime = String(form.get('mime') ?? '');
  const size = Number(form.get('size'));
  if (!TYPES.includes(mime)) return { error: 'Choose a PDF, PNG or JPG file.' };
  if (!(size > 0 && size <= MAX_BYTES)) return { error: 'The file must be between 1 byte and 50 MB.' };

  let documentId = form.get('document_id');
  const isNew = !isUuid(documentId);
  if (!isUuid(documentId)) {
    const subject = form.get('subject_id');
    const chapter = form.get('chapter_id');
    const subtopic = form.get('subtopic_id');
    const title = text(form, 'title', 200);
    if (!isUuid(subject) || !isUuid(chapter) || !isUuid(subtopic)) return { error: 'Open a subtopic to upload notes.' };
    if (!title) return { error: 'Give the notes a title.' };
    // The 3-column FKs refuse a subtopic of another topic or subject (ADR-038).
    const { data, error } = await db
      .from('documents')
      .insert({ institute_id: institute.id, subject_id: subject, chapter_id: chapter, subtopic_id: subtopic, title })
      .select('id')
      .single();
    if (error) return { error: 'Could not create the document.' };
    documentId = data.id as string;
  }

  const { data: last } = await db
    .from('document_versions')
    .select('version')
    .eq('institute_id', institute.id)
    .eq('document_id', documentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionId = randomUUID();
  const path = `${institute.id}/${documentId}/${versionId}`;
  const { error } = await db.from('document_versions').insert({
    id: versionId,
    institute_id: institute.id,
    document_id: documentId,
    version: (last?.version ?? 0) + 1,
    storage_path: path,
    mime,
    size_bytes: size,
  });
  // A refused first version must not leave an empty document behind.
  if (error && isNew) await db.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', documentId);
  if (error?.message === 'file_too_large') return { error: 'The file is larger than your institute’s upload limit.' };
  if (error?.message === 'storage_full') return { error: 'Your institute’s storage is full. Ask your admin.' };
  if (error) return { error: 'Could not start the upload.' };
  const { data: signed, error: signError } = await db.storage.from('documents').createSignedUploadUrl(path);
  if (signError) return { error: 'Could not start the upload.' };
  return { documentId, versionId, signedUrl: signed.signedUrl };
}

// Step 2 (after the browser uploaded the file): hand the version to the worker.
export async function confirmUpload(versionId: string) {
  const { institute, db } = await requireMember(STAFF);
  if (!isUuid(versionId)) return { error: 'invalid' };
  const { data, error } = await db
    .from('document_versions')
    .update({ processing_status: 'queued' })
    .eq('institute_id', institute.id)
    .eq('id', versionId)
    .eq('processing_status', 'uploading')
    .select('document_id')
    .maybeSingle();
  if (error) return { error: 'Could not queue the file.' };
  if (data) await publishUpload(db, institute.id, data.document_id as string);
  return {};
}

// A teacher's own notes need no check (founder, R1.2): a new uploaded document gets its subject's batch as audience
// now, and the database publishes it when the worker has read the file (migration 24). AI notes stay drafts until
// the teacher publishes them (ADR-039).
async function publishUpload(db: Db, inst: string, doc: string) {
  const { data: d } = await db
    .from('documents')
    .select('status, kind, subjects(batch_id)')
    .eq('institute_id', inst)
    .eq('id', doc)
    .maybeSingle();
  const batch = (d?.subjects as unknown as { batch_id: string } | null)?.batch_id;
  if (d?.status !== 'draft' || d.kind !== 'file' || !batch) return;
  // RLS refuses a batch the caller may not publish to; the teacher can still choose batches on the notes page.
  await db.from('document_audience').insert({ institute_id: inst, document_id: doc, batch_id: batch });
}

// Retry a failed version or reprocess a ready one (e.g. after a chunker change).
export async function requeueVersion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const doc = form.get('document_id');
  const version = form.get('version_id');
  if (!isUuid(doc) || !isUuid(version)) done('/subjects', { code: '23514' });
  const { error } = await db
    .from('document_versions')
    .update({ processing_status: 'queued' })
    .eq('institute_id', institute.id)
    .eq('document_id', doc)
    .eq('id', version)
    .in('processing_status', ['failed', 'ready']);
  done(`/documents/${doc}`, error, 'queued');
}

// Publish to the chosen batches (teachers: only batches they teach — the audience policy enforces it).
export async function publishDocument(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const doc = form.get('document_id');
  if (!isUuid(doc)) done('/subjects', { code: '23514' });
  const path = `/documents/${doc}`;
  const wanted = new Set(form.getAll('batch_id').filter(isUuid));
  if (!wanted.size) done(path, { message: 'document_no_batches' });
  const { data: current, error: readError } = await db
    .from('document_audience')
    .select('batch_id')
    .eq('institute_id', institute.id)
    .eq('document_id', doc);
  if (readError) done(path, readError);
  const have = new Set(current!.map((r) => r.batch_id as string));
  const add = [...wanted].filter((b) => !have.has(b));
  const remove = [...have].filter((b) => !wanted.has(b));
  if (add.length) {
    const rows = add.map((batch_id) => ({ institute_id: institute.id, document_id: doc, batch_id }));
    const { error } = await db.from('document_audience').insert(rows);
    if (error) done(path, error);
  }
  if (remove.length) {
    const { error } = await db
      .from('document_audience')
      .delete()
      .eq('institute_id', institute.id)
      .eq('document_id', doc)
      .in('batch_id', remove);
    if (error) done(path, error);
  }
  const { error } = await db
    .from('documents')
    .update({ status: 'published' })
    .eq('institute_id', institute.id)
    .eq('id', doc);
  done(path, error, 'published');
}

export async function withdrawDocument(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const doc = form.get('document_id');
  if (!isUuid(doc)) done('/subjects', { code: '23514' });
  const { error } = await db
    .from('documents')
    .update({ status: 'withdrawn' })
    .eq('institute_id', institute.id)
    .eq('id', doc);
  done(`/documents/${doc}`, error, 'withdrawn');
}

// Soft delete: students and the tutor lose it at once; its chunks go now, the file is purged later.
export async function deleteDocument(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const doc = form.get('document_id');
  if (!isUuid(doc)) done('/subjects', { code: '23514' });
  const { data, error } = await db
    .from('documents')
    .update({ deleted_at: new Date().toISOString(), status: 'withdrawn' })
    .eq('institute_id', institute.id)
    .eq('id', doc)
    .select('chapter_id')
    .single();
  if (error) done(`/documents/${doc}`, error);
  const { error: chunkError } = await db
    .from('document_chunks')
    .delete()
    .eq('institute_id', institute.id)
    .eq('document_id', doc);
  done(`/topics/${data!.chapter_id}`, chunkError, 'deleted');
}

// ---------------------------------------------------------------- AI notes (ADR-039)

// Stores Markdown as the document's next version, uploaded in the teacher's own session (the storage policy allows
// only this version's path), then hands it to the worker like any upload. Returns an error code or null.
async function addMarkdownVersion(db: Db, inst: string, doc: string, markdown: string) {
  const bytes = new TextEncoder().encode(markdown);
  const { data: last } = await db
    .from('document_versions')
    .select('version')
    .eq('institute_id', inst)
    .eq('document_id', doc)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = randomUUID();
  const path = `${inst}/${doc}/${id}`;
  const { error } = await db.from('document_versions').insert({
    id,
    institute_id: inst,
    document_id: doc,
    version: (last?.version ?? 0) + 1,
    storage_path: path,
    mime: 'text/markdown',
    size_bytes: bytes.length,
  });
  if (error) return error.message === 'storage_full' ? 'storage_full' : 'failed';
  const { error: upError } = await db.storage
    .from('documents')
    .upload(path, new Blob([bytes], { type: 'text/markdown' }), { contentType: 'text/markdown' });
  if (upError) return 'failed';
  const { error: qError } = await db
    .from('document_versions')
    .update({ processing_status: 'queued' })
    .eq('institute_id', inst)
    .eq('id', id)
    .eq('processing_status', 'uploading');
  return qError ? 'failed' : null;
}

// The teacher explains a subtopic; the AI writes notes; they are saved as a draft document the teacher then reads,
// edits and publishes like uploaded notes.
export async function writeAiNotes(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const chapter = form.get('chapter_id');
  const subtopic = form.get('subtopic_id');
  if (!isUuid(chapter) || !isUuid(subtopic)) redirect('/subjects');
  const here = `/topics/${chapter}`;
  const title = text(form, 'title', 200);
  const explanation = text(form, 'explanation', MAX_EXPLANATION);
  if (!title || !explanation) redirect(`${here}?error=invalid`);
  // RLS: staff of this institute only; the subtopic must belong to this topic.
  const { data: st } = await db
    .from('subtopics')
    .select('name, subject_id, chapters(name)')
    .eq('institute_id', institute.id)
    .eq('chapter_id', chapter)
    .eq('id', subtopic)
    .maybeSingle();
  if (!st) redirect(`${here}?error=denied`);
  const topic = (st!.chapters as unknown as { name: string }).name;

  let markdown = '';
  let code: string | null = null;
  try {
    markdown = await writeNotes(webMeter(db, institute.id), { topic, subtopic: st!.name, explanation });
  } catch (e) {
    code = e instanceof AiBlocked ? e.reason : e instanceof NotesError ? 'notes_refused' : 'generation_failed';
    if (code === 'generation_failed') log.error('notes.generate_failed', { institute: institute.id, error: e });
  }
  if (code) redirect(`${here}?error=${code}`);

  const { data: doc, error } = await db
    .from('documents')
    .insert({
      institute_id: institute.id,
      subject_id: st!.subject_id,
      chapter_id: chapter,
      subtopic_id: subtopic,
      title,
      kind: 'ai_notes',
    })
    .select('id')
    .single();
  if (error) done(here, error);
  const failed = await addMarkdownVersion(db, institute.id, doc!.id, markdown);
  // A note that could not be stored must not leave an empty document behind.
  if (failed) await db.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc!.id);
  redirect(failed ? `${here}?error=${failed}` : `/documents/${doc!.id}?ok=notes_written`);
}

// Saving edited AI notes = a new version; students keep the current one until it is processed.
export async function saveAiNotes(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const doc = form.get('document_id');
  if (!isUuid(doc)) redirect('/subjects');
  const path = `/documents/${doc}`;
  const markdown = String(form.get('markdown') ?? '').trim();
  if (!markdown || markdown.length > MAX_NOTES) redirect(`${path}?error=invalid`);
  const { data } = await db
    .from('documents')
    .select('id')
    .eq('institute_id', institute.id)
    .eq('id', doc)
    .eq('kind', 'ai_notes')
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) redirect(`${path}?error=denied`);
  const failed = await addMarkdownVersion(db, institute.id, doc as string, markdown);
  redirect(failed ? `${path}?error=${failed}` : `${path}?ok=notes_saved`);
}
