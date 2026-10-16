import { describe, expect, it } from 'vitest';
import type { Meter } from './gateway';
import { CHUNK_CHARS, embedLibraryItem, libraryChunks } from './library';

describe('libraryChunks', () => {
  it('keeps short items in one chunk headed by the topic', () => {
    expect(libraryChunks('Torque', 'Torque is r × F.\n\nUnit: N m.')).toEqual([
      'Torque\n\nTorque is r × F.\n\nUnit: N m.',
    ]);
  });
  it('groups paragraphs up to the limit and splits an over-long paragraph', () => {
    const para = 'a'.repeat(1000);
    const chunks = libraryChunks('T', [para, para, 'b'.repeat(CHUNK_CHARS * 2 + 5)].join('\n\n'));
    expect(chunks.map((c) => c.length - 3)).toEqual([1000, 1000, CHUNK_CHARS, CHUNK_CHARS, 5]);
    expect(chunks.every((c) => c.startsWith('T\n\n'))).toBe(true);
  });
});

describe('embedLibraryItem', () => {
  it('meters one library_embed call and returns a vector per chunk', async () => {
    const calls: unknown[][] = [];
    const meter: Meter = {
      reserve: async (...a) => (calls.push(a), { id: 'r1', blocked: null }),
      settle: async () => {},
    };
    const out = await embedLibraryItem(meter, 'Torque', 'Torque is r × F.');
    expect(calls).toEqual([['library_embed', 'fake', 'fake-bow-1', 0]]);
    expect(out.model).toBe('fake-bow-1');
    expect(out.chunks).toHaveLength(1);
    expect(out.chunks[0]!.embedding).toMatch(/^\[[-0-9.e,]+\]$/);
  });
});
