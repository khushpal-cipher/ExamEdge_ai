import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KIND } from '@/lib/library';
import { Markdown } from '@/lib/markdown';
import { isUuid } from '@/lib/tenant';
import { publishLibraryItem, saveLibraryItem, setLibraryStatus } from '../../../actions';
import { adminPage, LibraryFlash, STATUS_TONE } from '../../shared';

type Item = {
  id: string;
  topic_id: string;
  kind: string;
  content: { body: string };
  status: string;
  version: number;
  provenance: string;
  generated_by_model: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  library_topics: { name: string };
};

function StatusButton({
  id,
  status,
  label,
  primary,
}: {
  id: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setLibraryStatus}>
      <input type="hidden" name="item_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={primary ? 'primary' : ''}>
        {label}
      </button>
    </form>
  );
}

// Draft → reviewed (the reviewer is the person who clicks) → published → retired. Saving changed text returns the item
// to draft; publishing is refused by the database until a reviewer is recorded (AC8.2).
export default async function LibraryItemEditor(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const db = await adminPage();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data } = await db
    .from('library_items')
    .select(
      'id, topic_id, kind, content, status, version, provenance, generated_by_model, reviewed_by, reviewed_at, published_at, library_topics(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const item = data as unknown as Item;
  const { data: claims } = await db.auth.getClaims();
  const reviewer = item.reviewed_by === claims?.claims.sub ? 'you' : 'another platform admin';
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/library/topics/${item.topic_id}`}>{item.library_topics.name}</Link>
          </p>
          <h1>
            {KIND[item.kind]} · {item.library_topics.name}
          </h1>
          <p className="muted">
            <span className={`badge ${STATUS_TONE[item.status]}`}>{item.status}</span> · version {item.version}
            {item.reviewed_at &&
              ` · reviewed by ${reviewer} on ${new Date(item.reviewed_at).toLocaleDateString('en-IN')}`}
          </p>
        </div>
      </div>
      <LibraryFlash searchParams={props.searchParams} />
      <section className="card stack" aria-labelledby="review">
        <h2 id="review">Review and publish</h2>
        <div className="row">
          {item.status === 'draft' && <StatusButton id={item.id} status="reviewed" label="Mark as reviewed" primary />}
          {item.status === 'reviewed' && <StatusButton id={item.id} status="draft" label="Back to draft" />}
          {(item.status === 'reviewed' || item.status === 'retired') && (
            <form action={publishLibraryItem}>
              <input type="hidden" name="item_id" value={item.id} />
              <button type="submit" className="primary">
                Publish
              </button>
            </form>
          )}
          {item.status === 'published' && <StatusButton id={item.id} status="retired" label="Retire" />}
        </div>
        <p className="small muted">
          Provenance: {item.provenance}
          {item.generated_by_model && ` · drafted by ${item.generated_by_model}`}
        </p>
      </section>
      <section className="card stack" aria-labelledby="preview">
        <h2 id="preview">Preview</h2>
        <div className="reading md">
          <Markdown text={item.content.body} />
        </div>
      </section>
      <section className="card stack" aria-labelledby="edit">
        <h2 id="edit">Edit</h2>
        <p className="small muted">Saving changed text sends the item back to draft for a new review.</p>
        <form action={saveLibraryItem} className="stack">
          <input type="hidden" name="item_id" value={item.id} />
          <label>
            Kind
            <select name="kind" defaultValue={item.kind}>
              {Object.entries(KIND).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Text (Markdown, formulas in $…$)
            <textarea name="body" required rows={14} maxLength={20000} defaultValue={item.content.body} />
          </label>
          <label>
            Provenance
            <input name="provenance" required minLength={10} maxLength={1000} defaultValue={item.provenance} />
          </label>
          <button type="submit">Save</button>
        </form>
      </section>
    </>
  );
}
