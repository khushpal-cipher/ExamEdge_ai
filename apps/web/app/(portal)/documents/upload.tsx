'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { confirmUpload, startUpload } from './actions';

type Chapter = { id: string; name: string };

// New notes (subjectId + chapters) or a new version of an existing document (documentId). The file goes straight
// from the browser to Storage through a signed upload URL, so large PDFs never pass through the web server.
export function Upload(props: { subjectId?: string; chapters?: Chapter[]; documentId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) return setState({ error: 'Choose a file.' });
    form.delete('file');
    form.set('mime', file.type);
    form.set('size', String(file.size));
    setState({ busy: true });
    const ticket = await startUpload(form);
    if ('error' in ticket) return setState({ error: ticket.error });
    const res = await fetch(ticket.signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type, 'x-upsert': 'false' },
    }).catch(() => null);
    if (!res?.ok) return setState({ error: 'Upload failed. Check the file and try again.' });
    const queued = await confirmUpload(ticket.versionId);
    if (queued.error) return setState({ error: queued.error });
    router.push(`/documents/${ticket.documentId}?ok=uploaded`);
  }

  return (
    <form onSubmit={submit} className="stack" aria-label={props.documentId ? 'Upload a new version' : 'Upload notes'}>
      {props.documentId ? (
        <input type="hidden" name="document_id" value={props.documentId} />
      ) : (
        <>
          <input type="hidden" name="subject_id" value={props.subjectId} />
          <label>
            Title
            <input name="title" required maxLength={200} placeholder="Rotational Motion – class notes" />
          </label>
          <label>
            Chapter
            <select name="chapter_id" defaultValue="">
              <option value="">No chapter</option>
              {(props.chapters ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        File (PDF, PNG or JPG, up to 50 MB)
        <input type="file" name="file" required accept="application/pdf,image/png,image/jpeg" />
      </label>
      {state.error && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="primary" disabled={state.busy}>
        {state.busy ? 'Uploading…' : props.documentId ? 'Upload new version' : 'Upload'}
      </button>
    </form>
  );
}
