// OCR for scanned pages and photos, metered as feature ingest_ocr. Demo mode (AI_PROVIDER unset or "fake") returns a
// fixed, clearly marked text so the pipeline runs end to end; AI_PROVIDER=anthropic reads the page images with Claude
// Haiku (claudeOcr). The worker renders each page to an image only once the batch's reservation has passed.
import { claudeOcr } from './claude';
import { metered, type Meter } from './gateway';
import { fakeTokens, type Model, type Usage } from './routing';

// ≤ 20 images per call keeps the prompt under Haiku's 100K-token price tier (R-08) and below the API's stricter
// per-image size rule for requests with more than 20 images.
export const OCR_BATCH = 20;
// Worst case per page: a page image is ≤ 4,784 visual tokens at the 2,576 px limit (the worker renders ≤ 2,000 px),
// plus the instructions; output = Markdown of one dense page (the real call caps max_tokens to this).
export const PAGE_IN = 5000;
export const PAGE_OUT = 4000;

export type PageImage = { page: number; mime: 'image/jpeg' | 'image/png'; data: string }; // data = base64
export type OcrResult = { texts: string[]; usage: Usage; refused: boolean };
export interface OcrProvider {
  model: Model;
  read(images: PageImage[]): Promise<OcrResult>;
}

// The provider declined (stop_reason "refusal"); Haiku has no server-side fallback, so the version fails visibly.
export class OcrRefused extends Error {
  constructor() {
    super('ocr_refused');
  }
}

const fakeOcr: OcrProvider = {
  model: 'fake-ocr-1',
  async read(images) {
    const texts = images.map(
      (i) => `Scanned page ${i.page}. Demo mode: text is read from scanned pages once an AI key is set.`,
    );
    return { texts, usage: { output_tokens: fakeTokens(texts.join('\n')) }, refused: false };
  },
};

export function ocrProvider(env = process.env): OcrProvider {
  const p = env.AI_PROVIDER || 'fake';
  if (p === 'fake') return fakeOcr;
  if (p === 'anthropic') return claudeOcr();
  throw new Error(`Unknown AI_PROVIDER "${p}"`);
}

export async function ocrPages(
  meter: Meter,
  pages: number[],
  render: (page: number) => Promise<PageImage>,
  provider = ocrProvider(),
) {
  const texts: string[] = [];
  for (let i = 0; i < pages.length; i += OCR_BATCH) {
    const batch = pages.slice(i, i + OCR_BATCH);
    const worstCase = { input_tokens: batch.length * PAGE_IN, output_tokens: batch.length * PAGE_OUT };
    const out = await metered(meter, { feature: 'ingest_ocr', model: provider.model, worstCase }, async () => {
      const images = [];
      for (const n of batch) images.push(await render(n));
      const r = await provider.read(images);
      return {
        value: r,
        usage: { ...r.usage, units: batch.length },
        outcome: r.refused ? ('refused' as const) : ('ok' as const),
      };
    });
    if (out.refused) throw new OcrRefused();
    texts.push(...out.texts);
  }
  return { model: provider.model, texts };
}
