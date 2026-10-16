// ExamEdge library items → retrieval chunks (ADR-027). Paragraphs are grouped up to CHUNK_CHARS (≈ 400 tokens), each
// chunk starts with its topic name so keyword and vector search find it, and the chunks are embedded through the
// gateway as a platform call (feature library_embed: global kill switch, usage row without an institute).
import { embed, toVector } from './embed';
import type { Meter } from './gateway';

export const CHUNK_CHARS = 1_600;

export function libraryChunks(topic: string, body: string) {
  const out: string[] = [];
  let cur = '';
  for (const para of body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    for (let i = 0; i < para.length; i += CHUNK_CHARS) {
      const piece = para.slice(i, i + CHUNK_CHARS);
      if (cur && cur.length + piece.length + 2 > CHUNK_CHARS) {
        out.push(cur);
        cur = '';
      }
      cur = cur ? `${cur}\n\n${piece}` : piece;
    }
  }
  if (cur) out.push(cur);
  return out.map((c) => `${topic}\n\n${c}`);
}

export async function embedLibraryItem(meter: Meter, topic: string, body: string) {
  const texts = libraryChunks(topic, body);
  const { model, vectors } = await embed(meter, 'library_embed', texts, 'document');
  return { model, chunks: texts.map((content, i) => ({ content, embedding: toVector(vectors[i]!) })) };
}
