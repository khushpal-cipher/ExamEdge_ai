import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KIND } from '@/lib/library';
import { isUuid } from '@/lib/tenant';
import { createLibraryItem } from '../../../actions';
import { adminPage, LibraryFlash, STATUS_TONE } from '../../shared';

type Item = { id: string; kind: string; status: string; version: number; updated_at: string };
type Topic = {
  id: string;
  name: string;
  library_items: Item[];
  library_chapters: { name: string; subject_id: string };
};

export default async function LibraryTopic(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const db = await adminPage();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data } = await db
    .from('library_topics')
    .select('id, name, library_items(id, kind, status, version, updated_at), library_chapters(name, subject_id)')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const topic = data as unknown as Topic;
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/library/${topic.library_chapters.subject_id}`}>{topic.library_chapters.name}</Link>
          </p>
          <h1>{topic.name}</h1>
        </div>
      </div>
      <LibraryFlash searchParams={props.searchParams} />
      <section className="card">
        <h2>Items</h2>
        {topic.library_items.length === 0 ? (
          <p className="empty">No items yet.</p>
        ) : (
          <ul className="stack">
            {topic.library_items.map((i) => (
              <li key={i.id}>
                <Link href={`/library/items/${i.id}`}>{KIND[i.kind]}</Link>{' '}
                <span className={`badge ${STATUS_TONE[i.status]}`}>{i.status}</span>{' '}
                <span className="small muted">v{i.version}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack" aria-labelledby="new-item">
        <h2 id="new-item">New item</h2>
        <form action={createLibraryItem} className="stack">
          <input type="hidden" name="topic_id" value={topic.id} />
          <label>
            Kind
            <select name="kind">
              {Object.entries(KIND).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Text (Markdown, formulas in $…$)
            <textarea name="body" required rows={12} maxLength={20000} />
          </label>
          <label>
            Provenance (how it was made and why ExamEdge may use it)
            <input
              name="provenance"
              required
              minLength={10}
              maxLength={1000}
              placeholder="Written by ExamEdge staff; original text."
            />
          </label>
          <button type="submit" className="primary">
            Save draft
          </button>
        </form>
      </section>
    </>
  );
}
