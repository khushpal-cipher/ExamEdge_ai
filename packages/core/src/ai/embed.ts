// Embeddings for retrieval (the only module that will call an embeddings provider, ADR-009).
// Demo mode (EMBEDDINGS_PROVIDER unset or "fake"): a deterministic hashed bag of words, so a question shares
// dimensions with passages that use the same words. Voyage stays BLOCKED until Q-08 (data-use terms) is resolved.
// Every call is metered through the gateway (feature ingest_embed in the worker, query_embed for the tutor).
import { metered, type Meter } from './gateway';
import { fakeTokens, maxTokens } from './routing';

export const DIMS = 1024;

export function embeddingProvider(env = process.env) {
  const p = env.EMBEDDINGS_PROVIDER || 'fake';
  if (p !== 'fake') throw new Error(`embeddings provider "${p}" is not available yet (BLOCKED: Q-08, no key)`);
  return { name: p, model: 'fake-bow-1' as const };
}

// Letters with their combining marks (Devanagari matras, virama) and digits form one word.
export const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];

function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function fakeEmbedding(text: string) {
  const v = new Array<number>(DIMS).fill(0);
  for (const w of words(text)) v[fnv1a(w) % DIMS]! += 1;
  const norm = Math.hypot(...v);
  if (norm === 0) v[0] = 1; // cosine distance is undefined for a zero vector
  return norm === 0 ? v : v.map((x) => x / norm);
}

const sum = (texts: string[], f: (t: string) => number) => texts.reduce((n, t) => n + f(t), 0);

export async function embed(
  meter: Meter,
  feature: 'ingest_embed' | 'query_embed' | 'library_embed',
  texts: string[],
  _inputType: 'document' | 'query',
) {
  const { model } = embeddingProvider();
  return metered(meter, { feature, model, worstCase: { input_tokens: sum(texts, maxTokens) } }, async () => ({
    value: { model, vectors: texts.map(fakeEmbedding) },
    usage: { input_tokens: sum(texts, fakeTokens) },
  }));
}

// pgvector text literal.
export const toVector = (v: number[]) => `[${v.join(',')}]`;
