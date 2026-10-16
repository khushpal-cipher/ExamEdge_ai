import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { claudeStudio } from './claude';
import { AiBlocked, type Meter } from './gateway';
import {
  fakeContent,
  fakeStudio,
  generateArtifact,
  KINDS,
  SCHEMAS,
  StudioError,
  validateArtifact,
  type Source,
  type StudioProvider,
} from './studio';

const sources: Source[] = [
  {
    document_id: 'd1',
    title: 'Rotational Motion notes',
    page_start: 1,
    page_end: 1,
    content:
      'Rotational Motion\nTorque is the turning effect of a force about an axis. Torque equals r × F and is measured in newton metre. ' +
      'Moment of inertia measures how mass is distributed about the rotation axis. Angular momentum is conserved when no external torque acts.',
  },
  {
    document_id: 'd1',
    title: 'Rotational Motion notes',
    page_start: 2,
    page_end: 2,
    content: 'A figure skater spins faster when pulling her arms inward because her moment of inertia decreases.',
  },
  {
    document_id: 'd2',
    title: 'घूर्णन गति',
    page_start: 1,
    page_end: 1,
    content: 'बल आघूर्ण किसी अक्ष के परितः बल का घूर्णन प्रभाव है। जड़त्व आघूर्ण द्रव्यमान के वितरण पर निर्भर करता है।',
  },
];

function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: 'r1', blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

describe('demo generators (AC9.1, AC9.3)', () => {
  it.each(KINDS)('%s validates against its schema and cites a sent source everywhere', (kind) => {
    const content = fakeContent(kind, 'Rotational Motion', sources);
    expect(() => validateArtifact(kind, content, sources.length)).not.toThrow();
  });

  it('summary: one section per document, each citing its pages', () => {
    const { sections } = validateArtifact('summary', fakeContent('summary', 'Rotation', sources), 3);
    expect(sections.map((s) => [s.heading, s.cites])).toEqual([
      ['Rotational Motion notes', [0]],
      ['घूर्णन गति', [2]],
    ]);
  });

  it('flashcards: definitions become term → sentence cards', () => {
    const { cards } = validateArtifact('flashcards', fakeContent('flashcards', 'Rotation', sources), 3);
    expect(cards[0]).toEqual({
      front: 'Torque',
      back: 'Torque is the turning effect of a force about an axis.',
      cites: [0],
    });
    expect(new Set(cards.map((c) => c.front.toLowerCase())).size).toBe(cards.length);
  });

  it('quiz: the blanked word is the answer and appears among 4 distinct options', () => {
    const { questions } = validateArtifact('quiz', fakeContent('quiz', 'Rotation', sources), 3);
    expect(questions.length).toBeGreaterThan(2);
    for (const q of questions) {
      const answer = q.options.find((o) => o.id === q.answer)!.text;
      expect(q.stem).toContain('_____');
      expect(q.explanation.toLowerCase()).toContain(answer);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
    }
    // Not always the same position.
    expect(new Set(questions.map((q) => q.answer)).size).toBeGreaterThan(1);
  });

  it('is deterministic (same notes → same artifact)', () => {
    expect(fakeContent('quiz', 'Rotation', sources)).toEqual(fakeContent('quiz', 'Rotation', sources));
  });

  it('too little material for a quiz fails validation instead of storing an empty quiz', () => {
    const one = [{ ...sources[1]!, content: 'Work is force times distance.' }]; // 3 key words: no 3 distractors
    expect(() => validateArtifact('quiz', fakeContent('quiz', 'Rotation', one), 1)).toThrow();
  });
});

describe('validateArtifact rejects', () => {
  const quiz = () => structuredClone(validateArtifact('quiz', fakeContent('quiz', 'Rotation', sources), 3));
  it('a citation to a source that was not sent', () => {
    expect(() => validateArtifact('quiz', quiz(), 1)).toThrow('invalid_citation');
  });
  it('a section without citations', () => {
    expect(() => validateArtifact('summary', { sections: [{ heading: 'h', body: 'b', cites: [] }] }, 3)).toThrow();
  });
  it('an answer that is not an option, and duplicate ids', () => {
    const a = quiz();
    a.questions[0]!.answer = 'z';
    expect(() => validateArtifact('quiz', a, 3)).toThrow('invalid_quiz');
    const b = quiz();
    b.questions[1]!.id = b.questions[0]!.id;
    expect(() => validateArtifact('quiz', b, 3)).toThrow('invalid_quiz');
  });
  it('a mind map over 60 nodes', () => {
    const leaf = { label: 'x' };
    const twig = { label: 't', children: [leaf, leaf, leaf, leaf, leaf, leaf] };
    const branch = { label: 'b', cites: [0], children: Array(8).fill(twig) };
    expect(() => validateArtifact('mind_map', { root: 'r', branches: [branch, branch] }, 3)).toThrow(
      'mind_map_too_large',
    );
  });
});

describe('generateArtifact (gateway path)', () => {
  it('reserves feature "generation", settles the usage and returns the source refs', async () => {
    const { meter, calls } = fakeMeter();
    const out = await generateArtifact(meter, { kind: 'flashcards', chapter: 'Rotation', sources });
    expect(calls[0]!.slice(0, 4)).toEqual(['reserve', 'generation', 'fake', 'fake-studio-1']);
    expect(calls[1]![0]).toBe('settle');
    expect(calls[1]![4]).toBe('ok');
    expect(out.recordId).toBe('r1');
    expect(out.sourceRefs[0]).toEqual({
      document_id: 'd1',
      title: 'Rotational Motion notes',
      page_start: 1,
      page_end: 1,
    });
  });

  it('no sources → nothing reserved', async () => {
    const { meter, calls } = fakeMeter();
    await expect(generateArtifact(meter, { kind: 'summary', chapter: 'x', sources: [] })).rejects.toThrow(StudioError);
    expect(calls).toEqual([]);
  });

  it('blocked → the provider is never called', async () => {
    const { meter } = fakeMeter('quota');
    let called = false;
    const provider: StudioProvider = {
      ...fakeStudio,
      generate: async () => ((called = true), fakeStudio.generate) as never,
    };
    await expect(generateArtifact(meter, { kind: 'quiz', chapter: 'x', sources }, provider)).rejects.toBeInstanceOf(
      AiBlocked,
    );
    expect(called).toBe(false);
  });

  it('a refusal is settled as refused and reported', async () => {
    const { meter, calls } = fakeMeter();
    const provider: StudioProvider = {
      ...fakeStudio,
      generate: async () => ({ content: null, refused: true, usage: { input_tokens: 10 } }),
    };
    await expect(generateArtifact(meter, { kind: 'quiz', chapter: 'x', sources }, provider)).rejects.toThrow('refused');
    expect(calls[1]![4]).toBe('refused');
  });
});

describe('claudeStudio (recorded response, no key)', () => {
  it('sends numbered sources with the JSON schema and parses the reply', async () => {
    const requests: Record<string, unknown>[] = [];
    const content = fakeContent('flashcards', 'Rotation', sources);
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      const message = {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [{ type: 'text', text: JSON.stringify(content) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      };
      return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    };
    const sdk = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
    const out = await claudeStudio('claude-haiku-5-5', sdk).generate({
      kind: 'flashcards',
      chapter: 'Rotation',
      sources,
      system: 'sys',
      schema: SCHEMAS.flashcards,
    });
    expect(out).toMatchObject({ content, refused: false, usage: { input_tokens: 900, output_tokens: 300 } });
    const body = requests[0] as { output_config: { format: { type: string } }; messages: { content: string }[] };
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0]!.content).toContain('<source index="2" title="घूर्णन गति, p.1">');
    expect(body).not.toHaveProperty('fallbacks'); // Haiku has no server-side fallback
  });
});
