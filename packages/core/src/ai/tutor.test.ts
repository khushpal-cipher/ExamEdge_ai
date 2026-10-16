import { describe, expect, it } from 'vitest';
import { AiBlocked, type Meter } from './gateway';
import {
  assemble,
  capPassages,
  fakeTutor,
  mergeLayers,
  NOT_FOUND_TEXT,
  PASSAGE_CHARS,
  REFUSED_TEXT,
  trimHistory,
  tutorAnswer,
  type Passage,
  type TutorProvider,
} from './tutor';

const INST = '11111111-1111-1111-1111-111111111111';
type NotesPassage = Extract<Passage, { document_id: string }>;
const passage = (content: string, extra: Partial<NotesPassage> = {}): NotesPassage => ({
  institute_id: INST,
  document_id: 'd1',
  title: 'Rotational Motion',
  page_start: 4,
  page_end: 4,
  content,
  ...extra,
});
const ROTATION = passage(
  'Chapter 7 Rotational Motion. Torque is the turning effect of a force about an axis. Its SI unit is N m.',
);
const FRICTION = passage('Kinetic friction is f = mu N.', {
  document_id: 'd2',
  title: 'Laws of Motion',
  page_start: 2,
});

function fakeMeter(blocked: string | null = null) {
  const calls: unknown[][] = [];
  const meter: Meter = {
    reserve: async (...a) => (calls.push(['reserve', ...a]), { id: 'rec-1', blocked }),
    settle: async (...a) => void calls.push(['settle', ...a]),
  };
  return { meter, calls };
}

describe('assemble (labels come from citations, never from the model)', () => {
  it('labels cited paragraphs as notes and uncited ones as general, numbering passages by first use', () => {
    const out = assemble(
      [
        { text: 'Torque is the turning effect.', cites: [{ passage: 1, cited_text: 'Torque…' }] },
        { text: ' Unit N m.\n\nIn general, ', cites: [{ passage: 0, cited_text: 'f…' }] },
        { text: 'rotation needs a lever arm.', cites: [] },
      ],
      [FRICTION, ROTATION],
    );
    expect(out.paragraphs).toEqual([
      { text: 'Torque is the turning effect. Unit N m.', label: 'notes', citations: [0, 1] },
      { text: 'In general, rotation needs a lever arm.', label: 'general', citations: [] },
    ]);
    expect(out.citations).toMatchObject([
      { document_id: 'd1', page_start: 4 },
      { document_id: 'd2', page_start: 2 },
    ]);
    expect(out.content).toBe('Torque is the turning effect. Unit N m.\n\nIn general, rotation needs a lever arm.');
    expect(out.notFound).toBe(false);
  });
  it('cites a page once when two passages come from it', () => {
    const out = assemble(
      [
        {
          text: 'A.',
          cites: [
            { passage: 0, cited_text: 'a' },
            { passage: 1, cited_text: 'b' },
          ],
        },
      ],
      [ROTATION, passage('Second chunk of page 4.')],
    );
    expect(out.citations).toHaveLength(1);
    expect(out.paragraphs[0]!.citations).toEqual([0]);
  });
  it('ignores a citation to a passage that was never sent, and reports "not found" without citations', () => {
    const out = assemble([{ text: 'Something.', cites: [{ passage: 7, cited_text: 'x' }] }], [ROTATION]);
    expect(out.paragraphs).toEqual([{ text: 'Something.', label: 'general', citations: [] }]);
    expect(out.notFound).toBe(true);
  });
});

describe('prompt size caps', () => {
  it('keeps the last turns that fit and starts with a question', () => {
    const turns = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      content: `t${i}`,
    }));
    expect(trimHistory(turns).map((t) => t.content)).toEqual(['t4', 't5', 't6', 't7', 't8']);
    expect(trimHistory([{ role: 'user', content: 'x'.repeat(13_000) }])).toEqual([]);
  });
  it('sends at most 8 passages and PASSAGE_CHARS characters', () => {
    expect(capPassages(Array.from({ length: 12 }, () => ROTATION))).toHaveLength(8);
    const big = passage('x'.repeat(PASSAGE_CHARS - 10));
    expect(capPassages([big, ROTATION])).toEqual([big]);
  });
});

describe('fake tutor (demo mode)', () => {
  const run = (question: string, passages: Passage[], premium = false) => {
    let streamed = '';
    return fakeTutor
      .generate({ system: '', question, history: [], passages, premium }, (t) => (streamed += t))
      .then((g) => ({ g, streamed }));
  };
  it('quotes the best-matching sentence with a citation to its passage (Hinglish question)', async () => {
    const { g, streamed } = await run('Torque kya hota hai?', [FRICTION, ROTATION]);
    const out = assemble(g.segments, [FRICTION, ROTATION]);
    expect(out.paragraphs[0]).toEqual({
      text: 'Torque is the turning effect of a force about an axis.',
      label: 'notes',
      citations: [0],
    });
    expect(out.citations[0]).toMatchObject({ document_id: 'd1' });
    expect(out.paragraphs.at(-1)!.label).toBe('general');
    expect(streamed).toBe(g.segments.map((s) => s.text).join(''));
    expect(g.usage.input_tokens).toBeGreaterThan(0);
  });
  it('says the notes do not cover it when no passage shares a content word', async () => {
    const { g } = await run('What is photosynthesis?', [ROTATION]);
    expect(assemble(g.segments, [ROTATION])).toMatchObject({ content: NOT_FOUND_TEXT, notFound: true });
  });
  it('numbers steps for "Solve step by step"', async () => {
    const { g } = await run('torque unit', [ROTATION], true);
    expect(g.segments[0]!.text).toMatch(/^Step 1: /);
  });
});

describe('tutorAnswer (gateway around retrieval and generation)', () => {
  const req = (passages: Passage[], premium = false) => ({
    institute: INST,
    question: 'What is torque?',
    history: [],
    premium,
    retrieve: async () => passages,
  });
  it('reserves the tutor counter first, then retrieves, answers and settles once', async () => {
    const { meter, calls } = fakeMeter();
    const out = await tutorAnswer(meter, req([ROTATION]), () => {});
    expect(calls.map((c) => c[0])).toEqual(['reserve', 'settle']);
    expect(calls[0]!.slice(1, 3)).toEqual(['tutor', 'fake']);
    expect(calls[1]![4]).toBe('ok');
    expect(out).toMatchObject({ recordId: 'rec-1', model: 'fake-tutor-1', refused: false });
    expect(out.paragraphs[0]!.label).toBe('notes');
  });
  it('uses the premium counter for step-by-step answers', async () => {
    const { meter, calls } = fakeMeter();
    await tutorAnswer(meter, req([ROTATION], true), () => {});
    expect(calls[0]![1]).toBe('tutor_premium');
  });
  it('never retrieves or calls the provider when blocked', async () => {
    const { meter } = fakeMeter('quota');
    let retrieved = false;
    const r = { ...req([]), retrieve: async () => ((retrieved = true), []) };
    await expect(tutorAnswer(meter, r, () => {})).rejects.toEqual(new AiBlocked('quota'));
    expect(retrieved).toBe(false);
  });
  it('refuses passages of another institute and settles the call as an error', async () => {
    const { meter, calls } = fakeMeter();
    const other = passage('Torque canary', { institute_id: '22222222-2222-2222-2222-222222222222' });
    await expect(tutorAnswer(meter, req([ROTATION, other]), () => {})).rejects.toThrow('tenant_mismatch');
    expect(calls[1]![4]).toBe('error');
  });
  it('replaces a refused answer with a friendly message', async () => {
    const { meter, calls } = fakeMeter();
    const refusing: TutorProvider = {
      model: 'fake-tutor-1',
      maxOutput: 10,
      generate: async () => ({ segments: [{ text: 'partial', cites: [] }], usage: {}, refused: true }),
    };
    const out = await tutorAnswer(meter, req([ROTATION]), () => {}, refusing);
    expect(out).toMatchObject({ content: REFUSED_TEXT, refused: true, citations: [] });
    expect(calls[1]![4]).toBe('refused');
  });
});

describe('ExamEdge library layer (Phase 8)', () => {
  const lib = (
    id: string,
    score: number,
    content = 'Escape velocity v = sqrt(2GM/R) is about 11.2 km/s.',
  ): Passage => ({
    source_kind: 'library',
    library_item_id: id,
    title: 'Escape velocity',
    content,
    score,
  });
  it('labels library-only paragraphs "library", institute-cited ones "notes", one citation per item', () => {
    const out = assemble(
      [
        {
          text: 'Torque is r × F.',
          cites: [
            { passage: 0, cited_text: 't' },
            { passage: 1, cited_text: 'e' },
          ],
        },
        {
          text: '\n\nEscape velocity is 11.2 km/s.',
          cites: [
            { passage: 1, cited_text: 'e' },
            { passage: 2, cited_text: 'e2' },
          ],
        },
        { text: '\n\nRest is general.', cites: [] },
      ],
      [ROTATION, lib('L1', 0.1), lib('L1', 0.09, 'Second chunk of the same item.')],
    );
    expect(out.paragraphs.map((p) => [p.label, p.citations])).toEqual([
      ['notes', [0, 1]],
      ['library', [1]],
      ['general', []],
    ]);
    expect(out.citations[1]).toEqual({
      source_kind: 'library',
      library_item_id: 'L1',
      title: 'Escape velocity',
      cited_text: 'e',
    });
    expect(out.notFound).toBe(false);
  });
  it('merges the layers by score with at most 6 of the 8 from either', () => {
    const inst = Array.from({ length: 10 }, (_, i) => passage(`n${i}`, { score: 1 - i / 100 }));
    const library = Array.from({ length: 10 }, (_, i) => lib(`L${i}`, 0.5 - i / 100));
    const merged = mergeLayers(inst, library);
    expect(merged).toHaveLength(8);
    expect(merged.map((p) => p.source_kind ?? 'institute')).toEqual([
      ...Array(6).fill('institute'),
      'library',
      'library',
    ]);
    expect(mergeLayers([], library)).toHaveLength(6);
    expect(mergeLayers([passage('x', { score: 0.2 })], [lib('L', 0.3)]).map((p) => p.content)).toEqual([
      library[0]!.content,
      'x',
    ]);
  });
  it('accepts global library passages but still refuses another institute', async () => {
    const { meter } = fakeMeter();
    const out = await tutorAnswer(
      meter,
      {
        institute: INST,
        question: 'What is escape velocity?',
        history: [],
        premium: false,
        retrieve: async () => [lib('L1', 0.3)],
      },
      () => {},
    );
    expect(out.paragraphs[0]).toMatchObject({ label: 'library', citations: [0] });
    expect(out.citations[0]).toMatchObject({ source_kind: 'library', library_item_id: 'L1' });
  });
});
