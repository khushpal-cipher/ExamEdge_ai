import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MAX_NOTES } from '@examedge/core/ai/notes';
import { Markdown } from '@/lib/markdown';
import { isUuid, requireMember } from '@/lib/tenant';
import { PrintButton } from './print';

// AI notes as an in-app page (ADR-039), for any member: RLS decides (students: notes published to their batches),
// and the file is downloaded in the user's own session, so the storage policy decides too.
export default async function NotesPage(props: { params: Promise<{ id: string }> }) {
  const { institute, db } = await requireMember();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { data: doc } = await db
    .from('documents')
    .select('title, chapter_id, current_version_id, chapters(name)')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .eq('kind', 'ai_notes')
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc?.current_version_id) notFound();
  const { data: blob } = await db.storage.from('documents').download(`${institute.id}/${id}/${doc.current_version_id}`);
  // Only a Markdown file is shown as notes.
  if (!blob || !blob.type.startsWith('text/markdown') || blob.size > MAX_NOTES * 4) notFound();
  const topic = doc.chapters as unknown as { name: string };
  return (
    <article className="stack notes">
      <div className="top no-print">
        <p className="small">
          <Link href={`/topics/${doc.chapter_id}`}>{topic.name}</Link>
        </p>
        <PrintButton />
      </div>
      <h1>{doc.title}</h1>
      <Markdown text={await blob.text()} />
    </article>
  );
}
