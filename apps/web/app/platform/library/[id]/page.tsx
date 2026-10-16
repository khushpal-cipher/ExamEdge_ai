import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/tenant';
import { createLibraryChapter, createLibraryTopic } from '../../actions';
import { adminPage, LibraryFlash } from '../shared';

type Topic = { id: string; name: string; position: number; library_items: { status: string; kind: string }[] };
type Chapter = { id: string; name: string; position: number; library_topics: Topic[] };

export default async function LibrarySubject(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const db = await adminPage();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data: subject } = await db
    .from('library_subjects')
    .select(
      'id, name, exams(name), library_chapters(id, name, position, library_topics(id, name, position, library_items(status, kind)))',
    )
    .eq('id', id)
    .maybeSingle();
  if (!subject) notFound();
  const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
  const chapters = [...(subject.library_chapters as Chapter[])].sort(byPosition);
  const topics = chapters.flatMap((c) => c.library_topics);
  // AC8.1 coverage: a topic is covered when it has a published explanation and a published formula sheet.
  const has = (t: Topic, kind: string) => t.library_items.some((i) => i.kind === kind && i.status === 'published');
  const covered = topics.filter((t) => has(t, 'explanation') && has(t, 'formula_sheet')).length;
  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/library">ExamEdge library</Link>
          </p>
          <h1>
            {(subject.exams as unknown as { name: string }).name} · {subject.name}
          </h1>
          <p className="muted">
            {chapters.length} chapters · {topics.length} topics · {covered} with a published explanation and formula
            sheet
          </p>
        </div>
      </div>
      <LibraryFlash searchParams={props.searchParams} />
      {chapters.map((c) => (
        <section key={c.id} className="card stack" aria-labelledby={`c-${c.id}`}>
          <h2 id={`c-${c.id}`}>
            {c.position}. {c.name}
          </h2>
          {c.library_topics.length === 0 ? (
            <p className="empty">No topics yet.</p>
          ) : (
            <ul className="stack">
              {[...c.library_topics].sort(byPosition).map((t) => {
                const n = (s: string) => t.library_items.filter((i) => i.status === s).length;
                return (
                  <li key={t.id}>
                    <Link href={`/library/topics/${t.id}`}>{t.name}</Link>{' '}
                    <span className="small muted">
                      {n('published')} published · {n('reviewed')} reviewed · {n('draft')} draft
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={createLibraryTopic} className="inline">
            <input type="hidden" name="subject_id" value={subject.id} />
            <input type="hidden" name="chapter_id" value={c.id} />
            <label>
              New topic
              <input name="name" required maxLength={200} />
            </label>
            <button type="submit">Add topic</button>
          </form>
        </section>
      ))}
      <section className="card stack" aria-labelledby="new-chapter">
        <h2 id="new-chapter">New chapter</h2>
        <form action={createLibraryChapter} className="inline">
          <input type="hidden" name="subject_id" value={subject.id} />
          <label>
            Name
            <input name="name" required maxLength={200} />
          </label>
          <button type="submit">Add chapter</button>
        </form>
      </section>
    </>
  );
}
