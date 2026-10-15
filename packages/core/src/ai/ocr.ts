// OCR for scanned pages and photos. Demo mode (AI_PROVIDER unset or "fake") returns a fixed, clearly marked text so
// the pipeline runs end to end; real OCR (Claude Haiku via the gateway) is added with the Anthropic provider in Phase 5.
export function ocrProvider(env = process.env) {
  const p = env.AI_PROVIDER || 'fake';
  if (p !== 'fake') throw new Error(`AI provider "${p}" OCR is not available yet (Phase 5 gateway)`);
  return { name: p, model: 'fake-ocr-1' };
}

export async function ocrPages(pages: number[]) {
  const { model } = ocrProvider();
  return {
    model,
    texts: pages.map((n) => `Scanned page ${n}. Demo mode: text is read from scanned pages once an AI key is set.`),
  };
}
