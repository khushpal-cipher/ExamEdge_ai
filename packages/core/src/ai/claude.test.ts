// The real provider without a key: the SDK runs against a recorded server-sent-event stream, so the request shape
// (search_result blocks, citations, effort, fallbacks) and the mapping of citations back to passages are checked.
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { claudeTutor } from './claude';
import { assemble, type Passage } from './tutor';

const passages: Passage[] = [
  { institute_id: 'i', document_id: 'd1', title: 'Laws', page_start: 2, page_end: 2, content: 'F = ma.' },
  { institute_id: 'i', document_id: 'd2', title: 'Rotation', page_start: 4, page_end: 5, content: 'Torque = r x F.' },
];

const sse = (events: object[]) =>
  events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

function recorded(stopReason: string) {
  const usage = { input_tokens: 812, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  return sse([
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { ...usage, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Torque is r × F.' } },
    {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'citations_delta',
        citation: {
          type: 'search_result_location',
          cited_text: 'Torque = r x F.',
          search_result_index: 1,
          source: 'inst:d2#p4',
          title: 'Your notes: Rotation, p.4',
          start_block_index: 0,
          end_block_index: 1,
        },
      },
    },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '', citations: null } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '\n\nIt makes things rotate.' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage },
    { type: 'message_stop' },
  ]);
}

function client(stopReason = 'end_turn') {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(recorded(stopReason), { headers: { 'content-type': 'text/event-stream' } });
  };
  return { requests, sdk: new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 }) };
}

const input = { system: 'SYSTEM', question: 'What is torque?', history: [], passages, premium: false };

describe('claudeTutor (recorded stream)', () => {
  it('sends passages as cited search results and maps citations back to them', async () => {
    const { sdk, requests } = client();
    let streamed = '';
    const g = await claudeTutor('claude-haiku-5-5', sdk).generate(input, (t) => (streamed += t));

    const body = requests[0]!.body;
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'output_config', 'stream', 'system']);
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', system: 'SYSTEM', output_config: { effort: 'low' } });
    const content = (body.messages as { content: { type: string; citations?: unknown }[] }[])[0]!.content;
    expect(content.map((c) => c.type)).toEqual(['search_result', 'search_result', 'text']);
    expect(content[1]).toMatchObject({ source: 'inst:d2#p4', citations: { enabled: true } });

    expect(streamed).toBe('Torque is r × F.\n\nIt makes things rotate.');
    expect(g).toMatchObject({
      refused: false,
      model: 'claude-haiku-5-5',
      usage: { input_tokens: 812, output_tokens: 40 },
    });
    const out = assemble(g.segments, passages);
    expect(out.paragraphs).toEqual([
      { text: 'Torque is r × F.', label: 'notes', citations: [0] },
      { text: 'It makes things rotate.', label: 'general', citations: [] },
    ]);
    expect(out.citations[0]).toMatchObject({ document_id: 'd2', page_start: 4, cited_text: 'Torque = r x F.' });
  });

  it('asks for server-side fallbacks on Sonnet and reports refusals', async () => {
    const { sdk, requests } = client('refusal');
    const g = await claudeTutor('claude-sonnet-5-5', sdk).generate({ ...input, premium: true }, () => {});
    expect(requests[0]!.body).toMatchObject({ fallbacks: 'default', output_config: { effort: 'medium' } });
    expect(requests[0]!.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(g.refused).toBe(true);
  });

  it('labels library passages as ExamEdge library search results', async () => {
    const { sdk, requests } = client();
    const library: Passage = { source_kind: 'library', library_item_id: 'L1', title: 'Torque', content: 'tau = r F' };
    await claudeTutor('claude-haiku-5-5', sdk).generate({ ...input, passages: [library] }, () => {});
    const content = (requests[0]!.body.messages as { content: object[] }[])[0]!.content;
    expect(content[0]).toMatchObject({ type: 'search_result', source: 'lib:L1', title: 'ExamEdge library: Torque' });
  });
});
