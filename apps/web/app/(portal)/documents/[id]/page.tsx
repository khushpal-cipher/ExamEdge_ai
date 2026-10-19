import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MAX_NOTES } from '@examedge/core/ai/notes';
import { formatTime } from '@/lib/assess';
import { Markdown } from '@/lib/markdown';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { Flash, type Search } from '../../flash';
import { deleteDocument, publishDocument, requeueVersion, saveAiNotes, withdrawDocument } from '../actions';
import { DOCUMENT_STATUS, ERROR_TEXT, VERSION_STATUS } from '../status';
import { Upload } from '../upload';
import { AutoRefresh } from './auto-refresh';

type Version = {
  id: string;
  version: number;
  processing_status: string;
  error_code: string | null;
  page_count: number | null;
  extraction_method: string | null;
  created_at: string;
  storage_path: string;
};
const METHOD: Record<string, string> = { text_layer: 'Text', ocr: 'Scanned (OCR)', mixed: 'Text + scanned' };

export default async function DocumentPage(props: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data: doc } = await db
    .from('documents')
    .select('id, title, kind, status, subject_id, chapter_id, current_version_id, published_at, deleted_at')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc) notFound();

  const [{ data: subject }, { data: versions }, { data: audience }, { data: studying }, { data: mine }] =
    await Promise.all([
      db.from('subjects').select('name').eq('institute_id', institute.id).eq('id', doc.subject_id).single(),
      db
        .from('document_versions')
        .select('id, version, processing_status, error_code, page_count, extraction_method, created_at, storage_path')
        .eq('institute_id', institute.id)
        .eq('document_id', id)
        .order('version', { ascending: false }),
      db.from('document_audience').select('batch_id').eq('institute_id', institute.id).eq('document_id', id),
      // Notes are published to their subject's own batch only (ADR-038; a trigger enforces it).
      db
        .from('subjects')
        .select('batches(id, name, archived_at)')
        .eq('institute_id', institute.id)
        .eq('id', doc.subject_id),
      // Teachers may publish only to batches they teach (the database enforces it too).
      member.role === 'teacher'
        ? db.from('batch_members').select('batch_id').eq('membership_id', member.id).eq('batch_role', 'teacher')
        : Promise.resolve({ data: null }),
    ]);
  const taught = mine ? new Set(mine.map((r) => r.batch_id as string)) : null;
  const batches = (studying ?? [])
    .map((r) => r.batches as unknown as { id: string; name: string; archived_at: string | null })
    .filter((b) => b && !b.archived_at && (!taught || taught.has(b.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chosen = new Set((audience ?? []).map((a) => a.batch_id as string));
  const rows = (versions ?? []) as Version[];
  const busy = rows.some((v) => ['queued', 'processing'].includes(v.processing_status));
  const [statusLabel, statusTone] = DOCUMENT_STATUS[doc.status]!;
  // AI notes are edited here: the newest stored version (it may still be processing), not only the live one.
  const aiNotes = doc.kind === 'ai_notes';
  const newest = aiNotes ? rows.find((v) => v.processing_status !== 'uploading') : undefined;
  const blob = newest ? (await db.storage.from('documents').download(newest.storage_path)).data : null;
  const markdown = blob && blob.size <= MAX_NOTES * 4 ? await blob.text() : '';

  return (
    <>
      <AutoRefresh active={busy} />
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/topics/${doc.chapter_id}`}>{subject?.name ?? 'Subject'}</Link>
          </p>
          <h1>{doc.title}</h1>
          <p>
            <span className={`badge ${statusTone}`}>{statusLabel}</span>
            {doc.published_at && doc.status === 'published' && (
              <span className="small muted"> since {formatTime(doc.published_at)}</span>
            )}
          </p>
        </div>
        {doc.current_version_id &&
          (aiNotes ? (
            <Link className="button" href={`/notes/${id}`}>
              Open notes page
            </Link>
          ) : (
            <a className="button" href={`/documents/${id}/file`} target="_blank" rel="noopener">
              Open file
            </a>
          ))}
      </div>
      <Flash searchParams={props.searchParams} />

      {aiNotes && (
        <section className="card stack" aria-labelledby="notes">
          <h2 id="notes">Notes</h2>
          {markdown ? <Markdown text={markdown} /> : <p className="empty">These notes could not be loaded.</p>}
          <details>
            <summary>Edit notes</summary>
            <form action={saveAiNotes} className="stack">
              <input type="hidden" name="document_id" value={id} />
              <label className="stack">
                Notes (Markdown)
                <textarea name="markdown" rows={20} required maxLength={MAX_NOTES} defaultValue={markdown} />
              </label>
              <p className="small muted">
                Saving makes a new version; students keep the current one until it is ready.
              </p>
              <div className="row">
                <button type="submit" className="primary">
                  Save
                </button>
              </div>
            </form>
          </details>
        </section>
      )}

      <section className="card stack" aria-labelledby="who">
        <h2 id="who">Who can see it</h2>
        {!doc.current_version_id && <p className="muted">You can publish once the file has been processed.</p>}
        {batches.length === 0 ? (
          <p className="empty">This subject&apos;s batch is archived or is not one you teach.</p>
        ) : (
          <form action={publishDocument} className="stack">
            <input type="hidden" name="document_id" value={id} />
            <fieldset className="stack">
              <legend>Batches</legend>
              {batches.map((b) => (
                <label key={b.id} className="row">
                  <input type="checkbox" name="batch_id" value={b.id} defaultChecked={chosen.has(b.id)} />
                  {b.name}
                </label>
              ))}
            </fieldset>
            <div className="row">
              <button type="submit" className="primary" disabled={!doc.current_version_id}>
                {doc.status === 'published' ? 'Update batches' : 'Publish'}
              </button>
            </div>
          </form>
        )}
        {doc.status === 'published' && (
          <form action={withdrawDocument}>
            <input type="hidden" name="document_id" value={id} />
            <button type="submit" className="danger">
              Withdraw (students lose access now)
            </button>
          </form>
        )}
      </section>

      <section className="card stack" aria-labelledby="versions">
        <h2 id="versions">Files</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Pages</th>
                <th scope="col">Read as</th>
                <th scope="col">Uploaded</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const [label, tone] = VERSION_STATUS[v.processing_status]!;
                return (
                  <tr key={v.id}>
                    <td>
                      {v.version}
                      {v.id === doc.current_version_id && <span className="small muted"> (live)</span>}
                    </td>
                    <td>
                      <span className={`badge ${tone}`}>{label}</span>
                      {v.error_code && <div className="small">{ERROR_TEXT[v.error_code] ?? v.error_code}</div>}
                    </td>
                    <td>{v.page_count ?? '–'}</td>
                    <td>{v.extraction_method ? METHOD[v.extraction_method] : '–'}</td>
                    <td>{formatTime(v.created_at)}</td>
                    <td>
                      {['failed', 'ready'].includes(v.processing_status) && (
                        <form action={requeueVersion}>
                          <input type="hidden" name="document_id" value={id} />
                          <input type="hidden" name="version_id" value={v.id} />
                          <button type="submit" className="link">
                            {v.processing_status === 'failed' ? 'Retry' : 'Process again'}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!aiNotes && (
          <>
            <h3>Upload a new version</h3>
            <p className="small muted">Students keep seeing the current file until the new one is ready.</p>
            <Upload documentId={id} />
          </>
        )}
      </section>

      <form action={deleteDocument}>
        <input type="hidden" name="document_id" value={id} />
        <button type="submit" className="link danger">
          Delete these notes
        </button>
      </form>
    </>
  );
}
