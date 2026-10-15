// Splits page texts into retrieval chunks (AI_PIPELINE §3): a new chunk at every heading, otherwise ~600 tokens
// (max 800) with ~15 % overlap carried into the next chunk; page_start/page_end are kept. Tokens ≈ characters / 4.
export const CHUNKER_VERSION = 1;
const TARGET = 600;
const MAX = 800;
const OVERLAP = 90;

export type Page = { page: number; text: string };
export type Chunk = {
  chunk_index: number;
  page_start: number;
  page_end: number;
  heading_path: string | null;
  content: string;
  token_count: number;
};

export const tokens = (s: string) => Math.ceil(s.length / 4);

// "# Torque", "Chapter 7 Rotation", "7.2 Moment of inertia", or a short ALL-CAPS line.
const HEADING =
  /^(#{1,6}\s+\S.*|(Chapter|CHAPTER|Unit|UNIT|Section|SECTION)\s+\S.*|\d+(\.\d+)+\.?\s+\p{Lu}.*|(?=.*\p{Lu}.*\p{Lu})[\p{Lu}\d\s:&,'-]{3,60})$/u;
export const isHeading = (line: string) => line.length <= 100 && HEADING.test(line);

// A paragraph longer than MAX is cut at the last sentence end (or space) before the limit.
function pieces(text: string) {
  const out: string[] = [];
  const max = MAX * 4;
  while (text.length > max) {
    const dot = text.lastIndexOf('. ', max);
    const cut = dot > 0 ? dot + 1 : Math.max(text.lastIndexOf(' ', max), 1);
    out.push(text.slice(0, cut).trim());
    text = text.slice(cut).trim();
  }
  if (text) out.push(text);
  return out;
}

export function chunkPages(pages: Page[]): Chunk[] {
  const chunks: Chunk[] = [];
  let lines: { text: string; page: number }[] = [];
  let carried = 0; // leading lines repeated from the previous chunk (overlap)
  let heading: string | null = null;
  const size = () => lines.reduce((n, l) => n + tokens(l.text) + 1, 0);

  const flush = (overlap: boolean) => {
    if (lines.length > carried) {
      const content = lines.map((l) => l.text).join('\n');
      chunks.push({
        chunk_index: chunks.length,
        page_start: lines[0]!.page,
        page_end: lines.at(-1)!.page,
        heading_path: heading,
        content,
        token_count: tokens(content),
      });
    }
    const keep: typeof lines = [];
    for (let i = lines.length - 1, n = 0; overlap && i > 0 && n + tokens(lines[i]!.text) <= OVERLAP; i--) {
      keep.unshift(lines[i]!);
      n += tokens(lines[i]!.text);
    }
    lines = keep;
    carried = keep.length;
  };

  for (const { page, text: pageText } of pages) {
    for (const raw of pageText.split('\n')) {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (isHeading(text)) {
        flush(false);
        heading = text.replace(/^#+\s*/, '');
        lines.push({ text, page });
        continue;
      }
      for (const piece of pieces(text)) {
        if (size() + tokens(piece) > MAX) flush(true);
        lines.push({ text: piece, page });
        if (size() >= TARGET) flush(true);
      }
    }
  }
  flush(false);
  return chunks;
}
