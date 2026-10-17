// File validation and per-page text (AI_PIPELINE §3). PDF text layer via pdfjs-dist (ADR-024); pages whose text
// layer is missing or garbled, and photos, go to OCR. Limits follow Q-12 defaults: 50 MB, 300 pages.
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
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

// Scanned pages and photos are sent as JPEG with the long edge ≤ 2,000 px: enough for small print, ≤ 3,700 visual
// tokens per page, and ≤ ~1 MB each so a 20-page batch stays well under the 32 MB request limit [E].
const OCR_EDGE = 2000;
async function jpeg(page: number, w: number, h: number, draw: (canvas: Canvas) => unknown) {
  const canvas = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  const ctx = canvas.getContext('2d');
  // The canvas binding throws on a NUL character, which garbled text layers (the pages sent to OCR) often contain.
  const [fill, stroke] = [ctx.fillText.bind(ctx), ctx.strokeText.bind(ctx)];
  ctx.fillText = (t, ...a) => fill(t.replaceAll('\0', ''), ...a);
  ctx.strokeText = (t, ...a) => stroke(t.replaceAll('\0', ''), ...a);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await draw(canvas);
  return { page, mime: 'image/jpeg' as const, data: (await canvas.encode('jpeg', 85)).toString('base64') };
}

async function pdfText(doc: PDFDocumentProxy): Promise<Page[]> {
  if (doc.numPages > MAX_PAGES) throw new IngestError('too_many_pages');
  const pages: Page[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const { items } = await (await doc.getPage(page)).getTextContent();
    pages.push({ page, text: items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join('') });
  }
  return pages;
}

async function renderPdfPage(doc: PDFDocumentProxy, n: number) {
  const page = await doc.getPage(n);
  const { width, height } = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: OCR_EDGE / Math.max(width, height) });
  return jpeg(
    n,
    viewport.width,
    viewport.height,
    (canvas) => page.render({ canvas: canvas as never, viewport }).promise,
  );
}

export async function readPages(bytes: Uint8Array, mime: string, meter: Meter) {
  if (bytes.length === 0) throw new IngestError('empty_file');
  if (bytes.length > MAX_BYTES) throw new IngestError('too_large');
  // AI notes (ADR-039): Markdown text, one page, no OCR. Bytes that are not UTF-8 are a corrupt file.
  if (mime === 'text/markdown') {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new IngestError('corrupt_file');
    }
    return { pages: [{ page: 1, text }], method: 'text_layer' };
  }
  const magic = MAGIC[mime];
  if (!magic || !magic.every((b, i) => bytes[i] === b)) throw new IngestError('wrong_file_type');
  if (mime !== 'application/pdf') {
    const img = await loadImage(bytes).catch(() => {
      throw new IngestError('corrupt_file');
    });
    const s = Math.min(1, OCR_EDGE / Math.max(img.width, img.height));
    const [w, h] = [img.width * s, img.height * s];
    const { texts } = await ocrPages(meter, [1], () =>
      jpeg(1, w, h, (canvas) => canvas.getContext('2d').drawImage(img, 0, 0, w, h)),
    );
    return { pages: [{ page: 1, text: texts[0]! }], method: 'ocr' };
  }
  // pdfjs takes ownership of the buffer it is given, so it gets a copy.
  const task = getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 });
  try {
    const doc = await task.promise.catch(() => null);
    const pages = doc && (await pdfText(doc).catch((e) => (e instanceof IngestError ? Promise.reject(e) : null)));
    if (!doc || !pages) throw new IngestError('corrupt_file');
    const low = pages.filter((p) => needsOcr(p.text));
    if (low.length) {
      const { texts } = await ocrPages(
        meter,
        low.map((p) => p.page),
        (n) => renderPdfPage(doc, n),
      );
      low.forEach((p, i) => (p.text = texts[i]!));
    }
    const method = low.length === 0 ? 'text_layer' : low.length === pages.length ? 'ocr' : 'mixed';
    return { pages, method };
  } finally {
    await task.destroy();
  }
}
