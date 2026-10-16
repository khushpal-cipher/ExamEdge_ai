'use server';

// Staff Server Functions for notes (Phase 4). Institute from the host, role re-checked, RLS + storage policies decide
// the rest. The file itself never passes through this server: the browser uploads it straight to Storage with a
// signed upload URL that the storage policy allows only for this version's own path (DATABASE_DESIGN §4.3).
import { randomUUID } from 'node:crypto';
import { done, text } from '../form';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';

const TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_BYTES = 50 * 1024 * 1024;

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
    const title = text(form, 'title', 200);
    if (!isUuid(subject) || !title) return { error: 'Give the notes a title.' };
    const { data, error } = await db
      .from('documents')
      .insert({ institute_id: institute.id, subject_id: subject, chapter_id: isUuid(chapter) ? chapter : null, title })
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
  const { error } = await db
    .from('document_versions')
    .update({ processing_status: 'queued' })
    .eq('institute_id', institute.id)
    .eq('id', versionId)
    .eq('processing_status', 'uploading');
  return error ? { error: 'Could not queue the file.' } : {};
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
    .select('subject_id')
    .single();
  if (error) done(`/documents/${doc}`, error);
  const { error: chunkError } = await db
    .from('document_chunks')
    .delete()
    .eq('institute_id', institute.id)
    .eq('document_id', doc);
  done(`/subjects/${data!.subject_id}`, chunkError, 'deleted');
}
