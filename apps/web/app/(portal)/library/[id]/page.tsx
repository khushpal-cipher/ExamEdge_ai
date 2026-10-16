import { notFound } from 'next/navigation';
import { Markdown } from '@/lib/markdown';
import { KIND } from '@/lib/library';
import { isUuid, requireMember } from '@/lib/tenant';

type Item = {
  kind: string;
  content: { body: string };
  version: number;
  reviewed_at: string;
  library_topics: { name: string; library_chapters: { name: string; library_subjects: { name: string } } };
};

// A published ExamEdge library item, opened from a tutor citation or the Sources pane. The library is global,
// reviewed content (ADR-010, ADR-027): RLS shows published items only.
export default async function LibraryItem(props: { params: Promise<{ id: string }> }) {
  const { db } = await requireMember();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data } = await db
    .from('library_items')
    .select('kind, content, version, reviewed_at, library_topics(name, library_chapters(name, library_subjects(name)))')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) notFound();
  const item = data as unknown as Item;
  const topic = item.library_topics;
  return (
    <>
      <div className="top">
        <div>
          <p className="small muted">
            ExamEdge library · {topic.library_chapters.library_subjects.name} · {topic.library_chapters.name}
          </p>
          <h1>{topic.name}</h1>
          <p className="muted">
            {KIND[item.kind]} · reviewed {new Date(item.reviewed_at).toLocaleDateString('en-IN')} · version{' '}
            {item.version}
          </p>
        </div>
      </div>
      <article className="card reading md">
        <Markdown text={item.content.body} />
      </article>
    </>
  );
}
