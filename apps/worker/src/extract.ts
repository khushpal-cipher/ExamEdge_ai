// File validation and per-page text (AI_PIPELINE §3). PDF text layer via pdfjs-dist (ADR-024); pages whose text
// layer is missing or garbled, and photos, go to OCR. Limits follow Q-12 defaults: 50 MB, 300 pages.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Meter } from '@examedge/core/ai/gateway';
import { ocrPages } from '@examedge/core/ai/ocr';
import type { Page } from './chunk';

export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 300;

// error_code values shown to staff (apps/web documents page explains each one).
export class IngestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};

// Under 50 visible characters, or more than 20 % replacement / private-use / control characters → OCR.
export function needsOcr(text: string) {
  const t = text.replace(/\s/g, '');
  if (t.length < 50) return true;
  return (t.match(/[�\p{Co}\p{Cc}]/gu)?.length ?? 0) / t.length > 0.2;
}

async function pdfText(bytes: Uint8Array): Promise<Page[]> {
  // pdfjs takes ownership of the buffer it is given, so it gets a copy.
  const task = getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 });
  try {
    const doc = await task.promise;
    if (doc.numPages > MAX_PAGES) throw new IngestError('too_many_pages');
    const pages: Page[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const { items } = await (await doc.getPage(page)).getTextContent();
      pages.push({ page, text: items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join('') });
    }
    return pages;
  } catch (e) {
    throw e instanceof IngestError ? e : new IngestError('corrupt_file');
  } finally {
    await task.destroy();
  }
}

export async function readPages(bytes: Uint8Array, mime: string, meter: Meter) {
  if (bytes.length === 0) throw new IngestError('empty_file');
  if (bytes.length > MAX_BYTES) throw new IngestError('too_large');
  const magic = MAGIC[mime];
  if (!magic || !magic.every((b, i) => bytes[i] === b)) throw new IngestError('wrong_file_type');
  const pages = mime === 'application/pdf' ? await pdfText(bytes) : [{ page: 1, text: '' }];
  const low = pages.filter((p) => needsOcr(p.text));
  if (low.length) {
    const { texts } = await ocrPages(
      meter,
      low.map((p) => p.page),
    );
    low.forEach((p, i) => (p.text = texts[i]!));
  }
  const method = low.length === 0 ? 'text_layer' : low.length === pages.length ? 'ocr' : 'mixed';
  return { pages, method };
}
