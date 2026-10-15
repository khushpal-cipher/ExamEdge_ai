// OCR for scanned pages and photos, metered as feature ingest_ocr. Demo mode (AI_PROVIDER unset or "fake") returns a
// fixed, clearly marked text so the pipeline runs end to end; real OCR (Claude Haiku) comes with the Anthropic provider.
import { metered, type Meter } from './gateway';
import { fakeTokens } from './routing';

// ≤ 20 pages per call keeps the prompt under Haiku's 100K-token price tier (R-08).
export const OCR_BATCH = 20;
// Worst case per page [E]: page image + text layer in, Markdown out (the real call caps max_tokens to this).
const PAGE_IN = 5000;
const PAGE_OUT = 4000;

export function ocrProvider(env = process.env) {
  const p = env.AI_PROVIDER || 'fake';
  if (p !== 'fake') throw new Error(`AI provider "${p}" OCR is not available yet (BLOCKED: no key)`);
  return { name: p, model: 'fake-ocr-1' as const };
}

export async function ocrPages(meter: Meter, pages: number[]) {
  const { model } = ocrProvider();
  const texts: string[] = [];
  for (let i = 0; i < pages.length; i += OCR_BATCH) {
    const batch = pages.slice(i, i + OCR_BATCH);
    const worstCase = { input_tokens: batch.length * PAGE_IN, output_tokens: batch.length * PAGE_OUT };
    const out = await metered(meter, { feature: 'ingest_ocr', model, worstCase }, async () => {
      const value = batch.map(
        (n) => `Scanned page ${n}. Demo mode: text is read from scanned pages once an AI key is set.`,
      );
      return { value, usage: { output_tokens: fakeTokens(value.join('\n')), units: batch.length } };
    });
    texts.push(...out);
  }
  return { model, texts };
}
