import { describe, expect, it } from 'vitest';
import { chunkPages, isHeading, tokens } from './chunk';

const sentence = (i: number) => `Sentence ${i} explains torque, angular momentum and the moment of inertia in detail.`;

describe('chunker', () => {
  it('detects headings', () => {
    expect(isHeading('# Torque')).toBe(true);
    expect(isHeading('Chapter 7 Rotational Motion')).toBe(true);
    expect(isHeading('7.2 Moment of inertia')).toBe(true);
    expect(isHeading('LAWS OF MOTION')).toBe(true);
    expect(isHeading('Torque is the turning effect of a force.')).toBe(false);
    expect(isHeading('1. The ball is thrown up')).toBe(false);
    expect(isHeading('2024')).toBe(false);
  });

  it('starts a new chunk at each heading and records it', () => {
    const chunks = chunkPages([
      { page: 1, text: '# Torque\nTorque is the turning effect of a force.' },
      { page: 2, text: '# Inertia\nInertia resists changes in motion.' },
    ]);
    expect(chunks.map((c) => [c.heading_path, c.page_start, c.page_end])).toEqual([
      ['Torque', 1, 1],
      ['Inertia', 2, 2],
    ]);
    expect(chunks[1]!.content).toBe('# Inertia\nInertia resists changes in motion.');
  });

  it('keeps chunks within 800 tokens, overlaps neighbours, and spans pages', () => {
    const pages = [1, 2, 3].map((page) => ({
      page,
      text: Array.from({ length: 40 }, (_, i) => sentence(page * 100 + i)).join('\n'),
    }));
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.token_count).toBeLessThanOrEqual(800);
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
    // The next chunk repeats a tail of the previous one (overlap) and then continues.
    const first = chunks[0]!.content.split('\n');
    const second = chunks[1]!.content.split('\n');
    const overlap = second.findIndex((l) => !first.includes(l));
    expect(overlap).toBeGreaterThan(0);
    expect(second.slice(0, overlap)).toEqual(first.slice(-overlap));
    expect(chunks.some((c) => c.page_end > c.page_start)).toBe(true);
    // Every line of the document appears in some chunk.
    const all = chunks.map((c) => c.content).join('\n');
    for (const p of pages) for (const line of p.text.split('\n')) expect(all).toContain(line);
  });

  it('cuts one very long paragraph at sentence ends', () => {
    const long = Array.from({ length: 200 }, (_, i) => sentence(i)).join(' ');
    const chunks = chunkPages([{ page: 4, text: long }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(tokens(c.content)).toBeLessThanOrEqual(800);
    expect(chunks[0]!.content.endsWith('.')).toBe(true);
  });

  it('returns nothing for pages without text and never repeats only the overlap', () => {
    expect(chunkPages([{ page: 1, text: '  \n ' }])).toEqual([]);
    const one = chunkPages([{ page: 1, text: 'Short note.' }]);
    expect(one).toHaveLength(1);
  });
});
