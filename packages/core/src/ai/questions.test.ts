import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { claudeQuestions } from './claude';
import { fnv1a } from './embed';
import { AiBlocked, type Meter } from './gateway';
import {
  agrees,
  fakeQuestions,
  generateQuestions,
  keyOf,
  QTYPES,
  QuestionError,
  secondOf,
  validDraft,
  type Draft,
  type QuestionProvider,
} from './questions';
import type { Source } from './studio';

const sources: Source[] = [
  {
    document_id: 'd1',
    title: 'Rotational Motion notes',
    page_start: 1,
    page_end: 1,
    content:
      'Torque is the turning effect of a force about an axis. Torque equals r × F and is measured in newton metre. ' +
      'Moment of inertia measures how mass is distributed about the rotation axis. Angular momentum is conserved when no external torque acts.',
  },
  {
    document_id: 'd2',
    title: 'Gravitation notes',
    page_start: 3,
    page_end: 3,
    content:
      'Near the surface of the Earth the acceleration due to gravity is about 9.8 metre per second squared. ' +
      'The escape velocity from the Earth is about 11.2 kilometre per second. A satellite in orbit is in continuous free fall towards the Earth.',
  },
];

function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  let n = 0;
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: `r${++n}`, blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

const req = (type: (typeof QTYPES)[number], count = 10) => ({
  type,
  count,
  difficulty: 'medium',
  chapter: 'Rotation',
  sources,
});

const mcq = (over: Partial<Draft> = {}): Draft => ({
  stem: 'Which quantity is conserved when no external torque acts?',
  options: [
    { id: 'a', text: 'Angular momentum' },
    { id: 'b', text: 'Torque' },
    { id: 'c', text: 'Force' },
    { id: 'd', text: 'Mass' },
  ],
  correct: ['a'],
  value: null,
  tolerance: null,
  explanation: 'No external torque → L is constant.',
  cites: [0],
  ...over,
});
const numerical = (over: Partial<Draft> = {}): Draft => ({
  ...mcq(),
  stem: 'What is g near the Earth in m/s²?',
  options: [],
  correct: [],
  value: 9.8,
  tolerance: 0.1,
  ...over,
});

describe('question rules (AC7.5)', () => {
  it('accepts well-formed questions of each type', () => {
    expect(validDraft('single', mcq(), 2)).toBe(true);
    expect(validDraft('multi', mcq({ correct: ['a', 'c'] }), 2)).toBe(true);
    expect(validDraft('numerical', numerical(), 2)).toBe(true);
  });

  it('drops questions the bank cannot use', () => {
    const swapped = mcq().options.reverse();
    expect(validDraft('single', mcq({ correct: ['a', 'b'] }), 2)).toBe(false); // two keys for one-correct
    expect(validDraft('single', mcq({ correct: ['e'] }), 2)).toBe(false); // key not an option
    expect(validDraft('single', mcq({ options: swapped }), 2)).toBe(false); // ids not a–d in order
    expect(validDraft('single', mcq({ options: mcq().options.slice(0, 3) }), 2)).toBe(false);
    const same = mcq().options.map((o) => ({ ...o, text: 'Torque' }));
    expect(validDraft('single', mcq({ options: same }), 2)).toBe(false); // duplicate option texts
    expect(validDraft('multi', mcq({ correct: [] }), 2)).toBe(false);
    expect(validDraft('multi', mcq({ correct: ['a', 'a'] }), 2)).toBe(false);
    expect(validDraft('single', mcq({ cites: [2] }), 2)).toBe(false); // cites a source that was not sent
    expect(validDraft('numerical', numerical({ tolerance: 0 }), 2)).toBe(false);
    expect(validDraft('numerical', numerical({ value: null }), 2)).toBe(false);
    expect(validDraft('numerical', numerical({ options: mcq().options }), 2)).toBe(false);
  });

  it('agreement = the second answer would be marked correct', () => {
    expect(agrees('multi', mcq({ correct: ['a', 'c'] }), { n: 1, correct: ['c', 'a'], value: null })).toBe(true);
    expect(agrees('multi', mcq({ correct: ['a', 'c'] }), { n: 1, correct: ['a'], value: null })).toBe(false);
    expect(agrees('single', mcq(), { n: 1, correct: ['b'], value: null })).toBe(false);
    expect(agrees('numerical', numerical(), { n: 1, correct: [], value: 9.9 })).toBe(true); // within ±0.1
    expect(agrees('numerical', numerical(), { n: 1, correct: [], value: 9.95 })).toBe(false);
    expect(agrees('numerical', numerical(), { n: 1, correct: [], value: null })).toBe(false);
  });

  it('keys and second answers have the question_keys shapes', () => {
    expect(keyOf('single', mcq())).toEqual({ correct: ['a'] });
    expect(keyOf('numerical', numerical())).toEqual({ value: 9.8, tolerance_abs: 0.1 });
    expect(secondOf('numerical', { n: 1, correct: [], value: 9.7 })).toEqual({ value: 9.7 });
    expect(secondOf('multi', { n: 1, correct: ['b'], value: null })).toEqual({ correct: ['b'] });
    expect(secondOf('single', null)).toBeNull();
  });
});

describe('generateQuestions with the demo provider', () => {
  it.each(QTYPES)('%s: valid questions, solved blind; only the demo-changed ones disagree', async (type) => {
    const { meter, calls } = fakeMeter();
    const { questions, solved } = await generateQuestions(meter, req(type));
    expect(solved).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(validDraft(type, q, sources.length)).toBe(true);
      // The demo solver finds every answer in the notes and changes every fourth one on purpose.
      expect(q.verification).toBe(fnv1a(q.stem) % 4 === 0 ? 'dual_solve_disagree' : 'dual_solve_agree');
    }
    // Two metered calls, both under the staff feature, each settled with its usage.
    expect(calls.map((c) => [c[0], c[1]])).toEqual([
      ['reserve', 'question_gen'],
      ['settle', 'r1'],
      ['reserve', 'question_gen'],
      ['settle', 'r2'],
    ]);
    expect(calls[0]!.slice(2, 4)).toEqual(['fake', 'fake-questions-1']);
    expect(calls[1]![4]).toBe('ok');
  });

  it('numerical demo questions come from numbers in the notes', async () => {
    const { questions } = await generateQuestions(fakeMeter().meter, req('numerical'));
    expect(questions.map((q) => q.value)).toEqual([9.8, 11.2]);
    expect(questions[0]!.stem).toContain('_____ metre per second squared');
  });

  it('never returns more than asked', async () => {
    const { questions } = await generateQuestions(fakeMeter().meter, req('single', 2));
    expect(questions).toHaveLength(2);
  });

  it('no notes → no_sources before any reservation', async () => {
    const { meter, calls } = fakeMeter();
    await expect(generateQuestions(meter, { ...req('single'), sources: [] })).rejects.toThrow(QuestionError);
    expect(calls).toEqual([]);
  });

  it('a blocked institute gets AiBlocked and nothing is generated', async () => {
    await expect(generateQuestions(fakeMeter('budget').meter, req('single'))).rejects.toThrow(AiBlocked);
  });

  const provider = (over: Partial<QuestionProvider>): QuestionProvider => ({ ...fakeQuestions, ...over });

  it('a refused write is settled as refused and reported', async () => {
    const { meter, calls } = fakeMeter();
    const p = provider({ write: async () => ({ content: null, refused: true, usage: { output_tokens: 5 } }) });
    await expect(generateQuestions(meter, req('single'), p)).rejects.toThrow('refused');
    expect(calls[1]![4]).toBe('refused');
  });

  it('only invalid questions → no_questions (the write is still paid for)', async () => {
    const { meter, calls } = fakeMeter();
    const bad = { questions: [mcq({ correct: ['a', 'b'] })] };
    const p = provider({ write: async () => ({ content: bad, refused: false, usage: { output_tokens: 50 } }) });
    await expect(generateQuestions(meter, req('single'), p)).rejects.toThrow('no_questions');
    expect(calls.filter((c) => c[0] === 'reserve')).toHaveLength(1);
    expect(calls[1]![4]).toBe('ok');
  });

  it('a failed or refused solve keeps the questions as unverified', async () => {
    for (const solve of [
      async () => {
        throw new Error('network');
      },
      async () => ({ content: null, refused: true, usage: {} }),
    ]) {
      const { meter } = fakeMeter();
      const { questions, solved } = await generateQuestions(meter, req('single'), provider({ solve }));
      expect(solved).toBe(false);
      expect(questions.every((q) => q.verification === 'unverified' && q.second === null)).toBe(true);
    }
  });

  it('a question the solver skipped is unverified, the rest are judged', async () => {
    const solve: QuestionProvider['solve'] = async () => ({
      content: { answers: [{ n: 1, correct: ['a'], value: null }] },
      refused: false,
      usage: {},
    });
    const write: QuestionProvider['write'] = async () => ({
      content: { questions: [mcq(), mcq({ stem: 'Second?' })] },
      refused: false,
      usage: {},
    });
    const { questions } = await generateQuestions(fakeMeter().meter, req('single'), provider({ write, solve }));
    expect(questions.map((q) => q.verification)).toEqual(['dual_solve_agree', 'unverified']);
  });
});

describe('claudeQuestions (recorded replies, no key)', () => {
  it('Opus writes and Sonnet solves with structured output, effort medium and the default fallback', async () => {
    const requests: { body: Record<string, unknown>; beta: string | null }[] = [];
    const replies = [{ questions: [mcq()] }, { answers: [{ n: 1, correct: ['a'], value: null }] }];
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push({ body: JSON.parse(String(init?.body)), beta: new Headers(init?.headers).get('anthropic-beta') });
      const message = {
        id: `msg_${requests.length}`,
        type: 'message',
        role: 'assistant',
        model: requests.length === 1 ? 'claude-opus-5-5' : 'claude-sonnet-5-5',
        content: [{ type: 'text', text: JSON.stringify(replies[requests.length - 1]) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      };
      return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    };
    const sdk = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
    const { meter } = fakeMeter();
    const { questions } = await generateQuestions(meter, req('single'), claudeQuestions(sdk));
    expect(questions).toMatchObject([{ correct: ['a'], verification: 'dual_solve_agree' }]);

    const [write, solve] = requests as [(typeof requests)[0], (typeof requests)[0]];
    expect(write.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16_000,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    expect(write.beta).toContain('server-side-fallback-2026-07-01');
    expect((write.body.messages as { content: string }[])[0]!.content).toContain(
      '<source index="1" title="Gravitation notes, p.3">',
    );
    expect(solve.body).toMatchObject({ model: 'claude-sonnet-5-5', fallbacks: 'default' });
    const asked = (solve.body.messages as { content: string }[])[0]!.content;
    expect(asked).toContain('<question n="1">');
    // Blind: the solver never sees the key or the explanation.
    expect(asked).not.toContain('No external torque →');
    expect(JSON.stringify(solve.body)).not.toContain('"correct":["a"]');
  });
});
