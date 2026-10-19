// The test-only Gemini provider without a key: fetch returns recorded replies, so the request shape, the [n] citation
// mapping, refusals and the retry are checked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { citeSegments, geminiOcr, geminiStudio, geminiTutor, jsonSchema } from './gemini';
import { SCHEMAS } from './studio';
import { assemble, type Passage } from './tutor';

const passages: Passage[] = [
  { institute_id: 'i', document_id: 'd1', title: 'Laws', page_start: 2, page_end: 2, content: 'F = ma.' },
  { institute_id: 'i', document_id: 'd2', title: 'Rotation', page_start: 4, page_end: 5, content: 'Torque = r x F.' },
];
const usageMetadata = {
  promptTokenCount: 900,
  candidatesTokenCount: 40,
  thoughtsTokenCount: 10,
  cachedContentTokenCount: 100,
};
const reply = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
  usageMetadata,
  modelVersion: 'gemini-3.5-flash-lite',
});

function recorded(...bodies: { status?: number; json?: object }[]) {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    requests.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const b = bodies[requests.length - 1]!;
    return new Response(JSON.stringify(b.json ?? {}), { status: b.status ?? 200 });
  }) as typeof fetch;
  return { requests, f };
}

beforeEach(() => void (process.env.GEMINI_API_KEY = 'test-key'));
afterEach(() => void delete process.env.GEMINI_API_KEY);

const input = { system: 'SYSTEM', question: 'What is torque?', history: [], passages, premium: false };

describe('geminiTutor (recorded reply)', () => {
  it('numbers the passages and maps [n] citations back to them', async () => {
    const { f, requests } = recorded({ json: reply('Torque is r × F. [1]\n\nIt makes things rotate.') });
    let streamed = '';
    const g = await geminiTutor(false, f).generate(input, (t) => (streamed += t));

    expect(requests[0]!.url).toMatch(/models\/gemini-3\.5-flash-lite:generateContent$/);
    expect(requests[0]!.headers.get('x-goog-api-key')).toBe('test-key');
    const body = requests[0]!.body as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    expect(body.systemInstruction.parts[0]!.text).toMatch(/^SYSTEM\nCite a passage/);
    expect(body.contents[0]!.parts[0]!.text).toContain('<passage index="1" title="Your notes: Rotation, p.4">');

    expect(streamed).toBe('Torque is r × F.\n\nIt makes things rotate.');
    expect(g).toMatchObject({
      refused: false,
      usage: { input_tokens: 800, output_tokens: 50, cache_read_tokens: 100 },
    });
    expect(assemble(g.segments, passages).paragraphs).toEqual([
      { text: 'Torque is r × F.', label: 'notes', citations: [0] },
      { text: 'It makes things rotate.', label: 'general', citations: [] },
    ]);
  });

  it('leaves brackets that name no sent passage in the text', () => {
    expect(citeSegments('Array a[5] holds five. [0]', passages)).toEqual([
      { text: 'Array a[5] holds five.', cites: [{ passage: 0, cited_text: 'F = ma.' }] },
    ]);
  });

  it('retries once when busy and reports a safety stop as refused', async () => {
    const { f, requests } = recorded({ status: 503 }, { json: reply('', 'SAFETY') });
    const g = await geminiTutor(true, f).generate({ ...input, premium: true }, () => {});
    expect(requests).toHaveLength(2);
    expect(requests[0]!.url).toContain('gemini-3.8-flash');
    expect(g.refused).toBe(true);
  });

  it('fails without leaking the reply body', async () => {
    const { f } = recorded({ status: 400, json: { error: { message: 'echo of the prompt' } } });
    await expect(geminiTutor(false, f).generate(input, () => {})).rejects.toThrow(/^gemini_http_400$/);
  });
});

describe('geminiStudio and geminiOcr (recorded reply)', () => {
  it('asks for JSON against the schema without maxItems and parses the reply', async () => {
    const content = { sections: [{ heading: 'H', body: 'B', cites: [] }] };
    const { f, requests } = recorded({ json: reply(JSON.stringify(content)) });
    const sources: never[] = [];
    const o = await geminiStudio('gemini-3.8-flash', f).generate({
      kind: 'summary',
      chapter: 'Motion',
      subject: 'Physics',
      sources,
      system: 'S',
      schema: SCHEMAS.summary,
    });
    expect(o.content).toEqual(content);
    const cfg = (requests[0]!.body as { generationConfig: Record<string, unknown> }).generationConfig;
    expect(cfg).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: 8192 });
    expect(JSON.stringify(cfg.responseJsonSchema)).not.toMatch(/maxItems|\$schema/);
    expect(JSON.stringify(jsonSchema(SCHEMAS.summary))).toContain('minItems');
  });

  it('a reply that is not JSON parses to null (fails validation later)', async () => {
    const { f } = recorded({ json: reply('not json') });
    const o = await geminiStudio('gemini-3.5-flash-lite', f).generate({
      kind: 'quiz',
      chapter: 'x',
      sources: [],
      system: 'S',
      schema: SCHEMAS.quiz,
    });
    expect(o.content).toBeNull();
  });

  it('sends labelled page images and splits the answer per page', async () => {
    const { f, requests } = recorded({ json: reply('<page n="3">\n# Torque\n</page>\n<page n="7">Half') });
    const r = await geminiOcr(f).read([
      { page: 3, mime: 'image/jpeg', data: 'AAAA' },
      { page: 7, mime: 'image/png', data: 'BBBB' },
    ]);
    const parts = (requests[0]!.body as { contents: { parts: object[] }[] }).contents[0]!.parts;
    expect(parts[3]).toEqual({ inline_data: { mime_type: 'image/png', data: 'BBBB' } });
    expect(r.texts).toEqual(['# Torque', 'Half']);
  });
});
