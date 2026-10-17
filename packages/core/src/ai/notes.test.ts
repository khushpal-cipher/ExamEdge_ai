import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { claudeNotes } from './claude';
import { AiBlocked, type Meter } from './gateway';
import { fakeNotes, NotesError, writeNotes, type NotesProvider } from './notes';

function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: `r${calls.length}`, blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

const req = {
  topic: 'Probability',
  subtopic: 'Bayes theorem',
  explanation: 'Bayes theorem reverses a conditional probability. P(A|B) = P(B|A) P(A) / P(B).',
};

describe('writeNotes (demo provider)', () => {
  it('turns the explanation into Markdown notes, metered as notes_gen', async () => {
    const { meter, calls } = fakeMeter();
    const md = await writeNotes(meter, req, fakeNotes);
    expect(md).toMatch(/^# Bayes theorem/);
    expect(md).toContain('- Bayes theorem reverses a conditional probability.');
    expect(calls.map((c) => c.slice(0, 3))).toEqual([
      ['reserve', 'notes_gen', 'fake'],
      ['settle', 'r1', expect.anything()],
    ]);
    expect(calls[1]![4]).toBe('ok');
  });

  it('refuses an empty explanation before reserving anything', async () => {
    const { meter, calls } = fakeMeter();
    await expect(writeNotes(meter, { ...req, explanation: '   ' }, fakeNotes)).rejects.toThrow(NotesError);
    expect(calls).toEqual([]);
  });

  it('never calls the provider when the budget is blocked', async () => {
    const { meter } = fakeMeter('quota');
    let called = false;
    const p: NotesProvider = { ...fakeNotes, write: async (i) => ((called = true), fakeNotes.write(i)) };
    await expect(writeNotes(meter, req, p)).rejects.toThrow(AiBlocked);
    expect(called).toBe(false);
  });

  it('settles a refusal as refused and reports it', async () => {
    const { meter, calls } = fakeMeter();
    const p: NotesProvider = {
      ...fakeNotes,
      write: async () => ({ markdown: '', refused: true, usage: { input_tokens: 50, output_tokens: 0 } }),
    };
    await expect(writeNotes(meter, req, p)).rejects.toThrow('refused');
    expect(calls[1]![4]).toBe('refused');
  });
});

describe('claudeNotes (recorded reply, no key)', () => {
  it('Sonnet writes with effort medium and the default fallback; the explanation is data', async () => {
    const requests: { body: Record<string, unknown>; beta: string | null }[] = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push({ body: JSON.parse(String(init?.body)), beta: new Headers(init?.headers).get('anthropic-beta') });
      const message = {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: '# Bayes theorem\n\nNotes.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 700, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      };
      return new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    };
    const { meter, calls } = fakeMeter();
    const md = await writeNotes(meter, req, claudeNotes(new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 })));
    expect(md).toBe('# Bayes theorem\n\nNotes.');
    const [r] = requests as [(typeof requests)[0]];
    expect(r.body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 16_000, fallbacks: 'default' });
    expect(r.body.output_config).toEqual({ effort: 'medium' });
    expect(r.beta).toContain('server-side-fallback-2026-07-01');
    expect((r.body.messages as { content: string }[])[0]!.content).toContain(
      `<teacher_explanation>\n${req.explanation}\n</teacher_explanation>`,
    );
    expect(calls[0]!.slice(0, 3)).toEqual(['reserve', 'notes_gen', 'anthropic']);
    expect(calls[1]![2]).toEqual({
      input_tokens: 700,
      output_tokens: 400,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    });
  });
});
