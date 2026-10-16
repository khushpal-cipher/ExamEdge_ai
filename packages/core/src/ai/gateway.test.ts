import { describe, expect, it, vi } from 'vitest';
import { embed } from './embed';
import { AiBlocked, metered, type Meter } from './gateway';
import { ocrPages } from './ocr';
import { cost, maxTokens } from './routing';

// Records every reserve/settle; `blocked` makes the next reservation fail.
function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: `r${calls.length}`, blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

describe('cost (micro-USD, hand-computed)', () => {
  it('prices Haiku in and out', () => {
    // 1,000 × $0.10/M + 500 × $0.50/M = 100 + 250 µ$
    expect(cost('claude-haiku-5-5', { input_tokens: 1000, output_tokens: 500 })).toBe(350);
  });
  it('switches Haiku to the long-prompt tier above 100K prompt tokens, counting cache tokens', () => {
    expect(cost('claude-haiku-5-5', { input_tokens: 100_000 })).toBe(10_000);
    // 90,001 in × 0.50 + 10,000 cache reads × 0.05 = 45,000.5 + 500 → rounded up
    expect(cost('claude-haiku-5-5', { input_tokens: 90_001, cache_read_tokens: 10_000 })).toBe(45_501);
  });
  it('prices Sonnet cache reads and writes', () => {
    // 2,000 × 2 + 1,000 × 10 + 10,000 × 0.10 + 3,000 × 2.50 = 4,000 + 10,000 + 1,000 + 7,500
    expect(
      cost('claude-sonnet-5-5', {
        input_tokens: 2000,
        output_tokens: 1000,
        cache_read_tokens: 10_000,
        cache_write_tokens: 3000,
      }),
    ).toBe(22_500);
  });
  it('halves Opus for the Batch API', () => {
    expect(cost('claude-opus-5-5', { input_tokens: 1000, output_tokens: 1000 })).toBe(24_000);
    expect(cost('claude-opus-5-5', { input_tokens: 1000, output_tokens: 1000 }, true)).toBe(12_000);
  });
  it('prices Voyage input only, rounds up, and charges nothing for fake models', () => {
    expect(cost('voyage-4', { input_tokens: 1_000_000 })).toBe(60_000);
    expect(cost('claude-haiku-5-5', { input_tokens: 1 })).toBe(1);
    expect(cost('fake-bow-1', { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(0);
  });
  it('bounds tokens by UTF-8 bytes (Hindi takes 3 bytes per letter)', () => {
    expect(maxTokens('abc')).toBe(3);
    expect(maxTokens('बल')).toBe(6);
  });
});

describe('metered', () => {
  it('reserves the worst case, runs, then settles the real cost', async () => {
    const { meter, calls } = fakeMeter();
    const value = await metered(
      meter,
      { feature: 'tutor', model: 'claude-haiku-5-5', worstCase: { input_tokens: 1000, output_tokens: 1000 } },
      async () => ({ value: 'answer', usage: { input_tokens: 1000, output_tokens: 10 } }),
    );
    expect(value).toBe('answer');
    expect(calls).toEqual([
      ['reserve', 'tutor', 'anthropic', 'claude-haiku-5-5', 600],
      ['settle', 'r1', { input_tokens: 1000, output_tokens: 10 }, 105, 'ok'],
    ]);
  });

  it('never calls the provider when blocked', async () => {
    const { meter, calls } = fakeMeter('quota');
    const run = vi.fn();
    const p = metered(meter, { feature: 'tutor', model: 'claude-haiku-5-5', worstCase: {} }, run);
    await expect(p).rejects.toBeInstanceOf(AiBlocked);
    await expect(p).rejects.toMatchObject({ reason: 'quota' });
    expect(run).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('settles a failed call as error and rethrows', async () => {
    const { meter, calls } = fakeMeter();
    const p = metered(meter, { feature: 'tutor', model: 'claude-haiku-5-5', worstCase: {} }, async () => {
      throw new Error('provider down');
    });
    await expect(p).rejects.toThrow('provider down');
    expect(calls[1]).toEqual(['settle', 'r1', {}, 0, 'error']);
  });
});

describe('fake providers go through the gateway', () => {
  it('embed records provider fake, cost 0 and a token estimate', async () => {
    const { meter, calls } = fakeMeter();
    const { vectors } = await embed(meter, 'query_embed', ['what is torque'], 'query');
    expect(vectors).toHaveLength(1);
    expect(calls).toEqual([
      ['reserve', 'query_embed', 'fake', 'fake-bow-1', 0],
      ['settle', 'r1', { input_tokens: 4 }, 0, 'ok'],
    ]);
  });

  it('OCR meters one call per 20 pages', async () => {
    const { meter, calls } = fakeMeter();
    const rendered: number[] = [];
    const { texts } = await ocrPages(
      meter,
      Array.from({ length: 41 }, (_, i) => i + 1),
      async (page) => (rendered.push(page), { page, mime: 'image/jpeg', data: '' }),
    );
    expect(rendered).toHaveLength(41);
    expect(texts).toHaveLength(41);
    expect(calls.filter((c) => c[0] === 'reserve')).toHaveLength(3);
    expect(calls.filter((c) => c[0] === 'settle').map((c) => (c[2] as { units: number }).units)).toEqual([20, 20, 1]);
  });

  it('blocked OCR stops before any text is produced', async () => {
    const render = vi.fn();
    await expect(ocrPages(fakeMeter('ai_disabled').meter, [1], render)).rejects.toMatchObject({
      reason: 'ai_disabled',
    });
    expect(render).not.toHaveBeenCalled();
  });
});
