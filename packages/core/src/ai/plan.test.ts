import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { claudePlan } from './claude';
import { AiBlocked, type Meter } from './gateway';
import { checkPlan, fakePlan, MAX_PARTS, PlanError, planTest } from './plan';

const topics = ['Networking', 'HTML', 'CSS'];

function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: 'r1', blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

describe('fakePlan (demo rules)', () => {
  it('splits each count over the named topics and reads the difficulty', () => {
    expect(fakePlan('10 MCQs + 5 theory on Networking and HTML, hard', topics)).toEqual({
      difficulty: 'hard',
      parts: [
        { topic: 0, type: 'single', count: 5 },
        { topic: 1, type: 'single', count: 5 },
        { topic: 0, type: 'written', count: 3 },
        { topic: 1, type: 'written', count: 2 },
      ],
    });
  });
  it('knows multi-correct and numerical; no topic named = every topic; medium by default', () => {
    expect(fakePlan('3 multiple correct MCQs and 2 numericals', ['Optics'])).toEqual({
      difficulty: 'medium',
      parts: [
        { topic: 0, type: 'multi', count: 3 },
        { topic: 0, type: 'numerical', count: 2 },
      ],
    });
  });
  it('asks for nothing when no count is given', () => {
    expect(fakePlan('make a nice test', topics).parts).toEqual([]);
  });
});

describe('checkPlan', () => {
  it('drops unknown topics and merges the same topic and type', () => {
    const plan = checkPlan(
      {
        difficulty: 'easy',
        parts: [
          { topic: 0, type: 'single', count: 3 },
          { topic: 0, type: 'single', count: 2 },
          { topic: 7, type: 'written', count: 4 },
        ],
      },
      3,
    );
    expect(plan).toEqual({ difficulty: 'easy', parts: [{ topic: 0, type: 'single', count: 5 }] });
  });
  it('refuses an empty or malformed plan as unclear', () => {
    expect(() => checkPlan({ difficulty: 'medium', parts: [] }, 3)).toThrow(PlanError);
    expect(() => checkPlan({ parts: 'x' }, 3)).toThrow('unclear');
  });
  it('refuses more than the limits', () => {
    const many = Array.from({ length: MAX_PARTS + 1 }, (_, i) => ({ topic: i, type: 'single', count: 1 }));
    expect(() => checkPlan({ difficulty: 'medium', parts: many }, 10)).toThrow('too_many');
    const big = [0, 1, 2].map((topic) => ({ topic, type: 'single', count: 15 }));
    expect(() => checkPlan({ difficulty: 'medium', parts: big }, 3)).toThrow('too_many');
  });
});

describe('planTest', () => {
  it('is metered as staff question generation', async () => {
    const { meter, calls } = fakeMeter();
    const plan = await planTest(meter, { request: '4 MCQs on CSS', topics });
    expect(plan.parts).toEqual([{ topic: 2, type: 'single', count: 4 }]);
    expect(calls[0]!.slice(0, 4)).toEqual(['reserve', 'question_gen', 'fake', 'fake-questions-1']);
    expect(calls[1]!.slice(0, 2)).toEqual(['settle', 'r1']);
  });
  it('stops before the provider when the budget is used up', async () => {
    const { meter } = fakeMeter('budget');
    await expect(planTest(meter, { request: '4 MCQs', topics })).rejects.toBeInstanceOf(AiBlocked);
  });
  it('an empty request is unclear without a call', async () => {
    const { meter, calls } = fakeMeter();
    await expect(planTest(meter, { request: '  ', topics })).rejects.toThrow('unclear');
    expect(calls).toEqual([]);
  });
});

describe('claudePlan (recorded reply, no key)', () => {
  it('Haiku, structured output, effort low; topics numbered and the request wrapped as data', async () => {
    const requests: Record<string, unknown>[] = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      const message = {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [
          {
            type: 'text',
            text: JSON.stringify({ difficulty: 'medium', parts: [{ topic: 1, type: 'written', count: 2 }] }),
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      };
      return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    };
    const { meter, calls } = fakeMeter();
    const plan = await planTest(
      meter,
      { request: '2 theory on HTML', topics },
      claudePlan(new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 })),
    );
    expect(plan.parts).toEqual([{ topic: 1, type: 'written', count: 2 }]);
    expect(requests[0]).toMatchObject({
      model: 'claude-haiku-5-5',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect((requests[0]!.messages as { content: string }[])[0]!.content).toBe(
      '<topics>\n0. Networking\n1. HTML\n2. CSS\n</topics>\n<request>\n2 theory on HTML\n</request>',
    );
    // Haiku: 300 × $0.10/M + 40 × $0.50/M = 50 µ$.
    expect(calls[1]).toMatchObject(['settle', 'r1', { input_tokens: 300, output_tokens: 40 }, 50, 'ok']);
  });
});
