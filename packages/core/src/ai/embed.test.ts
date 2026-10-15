import { describe, expect, it } from 'vitest';
import { DIMS, embeddingProvider, fakeEmbedding, toVector, words } from './embed';

const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

describe('fake embeddings', () => {
  it('are deterministic, unit length and 1024-dimensional', () => {
    const a = fakeEmbedding('Torque is the turning effect of a force');
    expect(a).toHaveLength(DIMS);
    expect(a).toEqual(fakeEmbedding('Torque is the turning effect of a force'));
    expect(Math.hypot(...a)).toBeCloseTo(1, 10);
  });

  it('rank a passage sharing the question words above an unrelated one', () => {
    const q = fakeEmbedding('what is torque');
    expect(cos(q, fakeEmbedding('Torque is the turning effect of a force.'))).toBeGreaterThan(
      cos(q, fakeEmbedding('Photosynthesis happens in chloroplasts.')),
    );
  });

  it('keep Hindi words whole (matras and virama are part of the word)', () => {
    expect(words('बल आघूर्ण')).toEqual(['बल', 'आघूर्ण']);
  });

  it('never return a zero vector', () => {
    expect(Math.hypot(...fakeEmbedding('...'))).toBe(1);
  });

  it('refuse a real provider until it is unblocked', () => {
    expect(embeddingProvider({}).name).toBe('fake');
    expect(() => embeddingProvider({ EMBEDDINGS_PROVIDER: 'voyage' })).toThrow(/BLOCKED/);
  });

  it('format a pgvector literal', () => {
    expect(toVector([1, 0.5])).toBe('[1,0.5]');
  });
});
