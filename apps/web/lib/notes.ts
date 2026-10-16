// A chapter's published notes as numbered sources for Studio and bank questions, read in the user's own session:
// RLS decides which notes they may use (students: notes published to their batches).
import type { Source } from '@examedge/core/ai/studio';
import type { supabase } from './supabase';

type Db = Awaited<ReturnType<typeof supabase>>;

// Ordered by document title, then chunk. `ids` are the chunk ids (they change when a note is replaced).
export async function chapterNotes(db: Db, inst: string, chapter: string) {
  const { data: docs } = await db
    .from('documents')
    .select('id, title')
    .eq('institute_id', inst)
    .eq('chapter_id', chapter)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('title');
  const title = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));
  const { data: chunks } = title.size
    ? await db
        .from('document_chunks')
        .select('id, document_id, page_start, page_end, content, chunk_index')
        .eq('institute_id', inst)
        .in('document_id', [...title.keys()])
        .order('chunk_index')
    : { data: [] };
  const rows = (chunks ?? []).sort(
    (a, b) => title.get(a.document_id)!.localeCompare(title.get(b.document_id)!) || a.chunk_index - b.chunk_index,
  );
  const sources: Source[] = rows.map((c) => ({
    document_id: c.document_id,
    title: title.get(c.document_id)!,
    page_start: c.page_start,
    page_end: c.page_end,
    content: c.content,
  }));
  return { ids: rows.map((c) => String(c.id)), sources };
}
