// Model routing and prices (AI_PIPELINE §1–2). Change a model or a price here only.
// Prices verified on the official pricing pages on 2026-10-16 (COST_MODEL §1), stored as micro-USD per 1,000 tokens
// (= USD per million tokens × 1,000) so cost math stays in integers.
export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  units?: number; // pages, searches, … (not priced here)
};

type Prices = { in: number; out: number; cacheRead: number; cacheWrite: number };
const FREE: Prices = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };

export const MODELS = {
  'claude-haiku-5-5': { provider: 'anthropic', prices: { in: 100, out: 500, cacheRead: 10, cacheWrite: 125 } },
  'claude-sonnet-5-5': { provider: 'anthropic', prices: { in: 2000, out: 10000, cacheRead: 100, cacheWrite: 2500 } },
  'claude-opus-5-5': { provider: 'anthropic', prices: { in: 4000, out: 20000, cacheRead: 200, cacheWrite: 5000 } },
  'voyage-4': { provider: 'voyage', prices: { in: 60, out: 0, cacheRead: 0, cacheWrite: 0 } },
  // Demo mode: same code paths, metered with token estimates, cost 0.
  'fake-bow-1': { provider: 'fake', prices: FREE },
  'fake-ocr-1': { provider: 'fake', prices: FREE },
  'fake-tutor-1': { provider: 'fake', prices: FREE },
  'fake-studio-1': { provider: 'fake', prices: FREE },
} as const satisfies Record<string, { provider: 'anthropic' | 'voyage' | 'fake'; prices: Prices }>;
export type Model = keyof typeof MODELS;

// Haiku costs 5× when the prompt (input + cache reads + cache writes) is over 100,000 tokens.
export const HAIKU_LONG_PROMPT = 100_000;
const HAIKU_LONG: Prices = { in: 500, out: 2500, cacheRead: 50, cacheWrite: 625 };

// Micro-USD, rounded up. Batch API = half price on everything (stacks with the cache multipliers).
export function cost(model: Model, u: Usage, batch = false) {
  const inp = u.input_tokens ?? 0;
  const read = u.cache_read_tokens ?? 0;
  const write = u.cache_write_tokens ?? 0;
  const p = model === 'claude-haiku-5-5' && inp + read + write > HAIKU_LONG_PROMPT ? HAIKU_LONG : MODELS[model].prices;
  const milli = inp * p.in + (u.output_tokens ?? 0) * p.out + read * p.cacheRead + write * p.cacheWrite;
  return Math.ceil(milli / (batch ? 2000 : 1000));
}

// Upper bound for a text's tokens before the call (no tokenizer needed): a token is at least one UTF-8 byte.
export const maxTokens = (text: string) => new TextEncoder().encode(text).length;
// Rough count the fake provider records as usage.
export const fakeTokens = (text: string) => Math.ceil(text.length / 4);
