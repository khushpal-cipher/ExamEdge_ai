// Test-only provider (ADR-051): Google Gemini on the free tier, over its REST API (no SDK). Used only when
// AI_PROVIDER=gemini and GEMINI_API_KEY is set. Free-tier inputs may be used by Google to improve its products, so it
// is for local test institutes only, never real student data; production stays on Claude (claude.ts).
// Same provider interfaces as Claude, metered through the same gateway at cost 0. Tested against recorded replies.
import { z } from 'zod';
import { OCR_SYSTEM, splitPages } from './claude';
import { notesMessage, type NotesProvider } from './notes';
import { PAGE_OUT, type OcrProvider } from './ocr';
import { PLAN_SCHEMA, planMessage, type PlanProvider } from './plan';
import { DRAFT_SCHEMA, solveMessage, SOLVE_SCHEMA, writeMessage, type QuestionProvider } from './questions';
import type { Usage } from './routing';
import type { StudioProvider } from './studio';
import type { Passage, Segment, TutorProvider } from './tutor';

type GeminiModel = 'gemini-3.8-flash' | 'gemini-3.5-flash-lite';
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
type Content = { role: 'user' | 'model'; parts: Part[] };
type Reply = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
};

const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_OUT = 65_536; // outputTokenLimit of these models (models.get, 2026-10-19)

// Gemini rejects some of our schemas when they carry maxItems ("invalid argument", 2026-10-19); the limits are still
// enforced by the Zod parse after the call, and the prompts state them.
export function jsonSchema(schema: z.ZodType) {
  const strip = (o: unknown): unknown =>
    Array.isArray(o)
      ? o.map(strip)
      : o && typeof o === 'object'
        ? Object.fromEntries(
            Object.entries(o)
              .filter(([k]) => k !== '$schema' && k !== 'maxItems')
              .map(([k, v]) => [k, strip(v)]),
          )
        : o;
  return strip(z.toJSONSchema(schema));
}

const parse = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null; // fails the schema check like Claude's null parsed_output
  }
};

async function call(
  f: typeof fetch,
  model: GeminiModel,
  req: { system: string; contents: Content[]; maxOutput: number; schema?: z.ZodType },
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.contents,
    generationConfig: {
      maxOutputTokens: Math.min(req.maxOutput, MAX_OUT),
      ...(req.schema ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema(req.schema) } : {}),
    },
  });
  const send = () =>
    f(`${API}${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body,
    });
  let res = await send();
  // The free tier answers 429 (rate limit) or 503 (busy) at times; one retry, like the Claude client's maxRetries: 1.
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await send();
  }
  // Still busy (503 "high demand", seen 2026-10-26): the lighter model usually has room.
  if (res.status === 503 && model === 'gemini-3.8-flash') return call(f, 'gemini-3.5-flash-lite', req);
  if (!res.ok) throw new Error(`gemini_http_${res.status}`); // status only: the body may echo the prompt
  const j = (await res.json()) as Reply;
  const c = j.candidates?.[0];
  const u = j.usageMetadata ?? {};
  const cached = u.cachedContentTokenCount ?? 0;
  const usage: Usage = {
    input_tokens: (u.promptTokenCount ?? 0) - cached,
    output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    cache_read_tokens: cached,
    cache_write_tokens: 0,
  };
  return {
    text: (c?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join(''),
    // A blocked prompt, or an answer stopped for safety, recitation, … counts as a refusal.
    refused: !!j.promptFeedback?.blockReason || !['STOP', 'MAX_TOKENS'].includes(c?.finishReason ?? ''),
    model: j.modelVersion ?? model,
    usage,
  };
}

// Gemini has no citation blocks, so passages are numbered and cited as [n]; each paragraph becomes one segment that
// cites the passages it names. Brackets naming no sent passage are left in the text.
const CITE_RULE = `
Cite a passage by writing its index in square brackets right after the sentence that uses it, for example [0] or [0][2].`;
export function citeSegments(text: string, passages: Passage[]): Segment[] {
  const pieces = text.split(/\n\s*\n/).filter((p) => p.trim());
  return pieces.map((p, i) => {
    const cited = new Set<number>();
    const clean = p.replace(/ ?\[(\d+)\]/g, (m, n: string) => {
      if (Number(n) >= passages.length) return m;
      cited.add(Number(n));
      return '';
    });
    return {
      text: clean + (i < pieces.length - 1 ? '\n\n' : ''),
      cites: [...cited].map((n) => ({ passage: n, cited_text: passages[n]!.content.slice(0, 300) })),
    };
  });
}

export function geminiTutor(premium: boolean, f: typeof fetch = fetch): TutorProvider {
  const model = premium ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite';
  const maxOutput = premium ? 8_192 : 4_096;
  return {
    model,
    maxOutput,
    async generate({ system, question, history, passages }, onText) {
      const notes = passages.length
        ? passages
            .map(
              (p, i) =>
                `<passage index="${i}" title="Your notes: ${p.title}, p.${p.page_start}">\n${p.content}\n</passage>`,
            )
            .join('\n')
        : '(No passages from your notes matched.)';
      const r = await call(f, model, {
        system: system + CITE_RULE,
        maxOutput,
        contents: [
          ...history.map((t): Content => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: t.content }],
          })),
          { role: 'user', parts: [{ text: `${notes}\n\n${question}` }] },
        ],
      });
      const segments = citeSegments(r.text, passages);
      // shortcut: not streamed, the answer shows at once; stream (streamGenerateContent?alt=sse) if Gemini goes past testing.
      onText(segments.map((s) => s.text).join(''));
      return { segments, refused: r.refused, model: r.model, usage: r.usage };
    },
  };
}

export function geminiOcr(f: typeof fetch = fetch): OcrProvider {
  const model = 'gemini-3.5-flash-lite';
  return {
    model,
    async read(images) {
      const r = await call(f, model, {
        system: OCR_SYSTEM,
        maxOutput: images.length * PAGE_OUT,
        contents: [
          {
            role: 'user',
            parts: [
              ...images.flatMap((i): Part[] => [
                { text: `Page ${i.page}:` },
                { inline_data: { mime_type: i.mime, data: i.data } },
              ]),
              { text: 'Transcribe these pages.' },
            ],
          },
        ],
      });
      const texts = splitPages(
        r.text,
        images.map((i) => i.page),
      );
      return { texts, refused: r.refused, usage: r.usage };
    },
  };
}

const user = (text: string): Content[] => [{ role: 'user', parts: [{ text }] }];

export function geminiStudio(model: GeminiModel, f: typeof fetch = fetch): StudioProvider {
  const maxOutput = 8_192;
  return {
    model,
    maxOutput,
    async generate({ chapter, subject, sources, system, schema }) {
      const notes = sources.length
        ? sources.map((s, i) => `<source index="${i}" title="${s.title}, p.${s.page_start}">\n${s.content}\n</source>`)
        : [`No institute notes for this topic.${subject ? ` Subject: ${subject}.` : ''}`];
      const r = await call(f, model, {
        system,
        maxOutput,
        schema,
        contents: user(`${notes.join('\n')}\n\nChapter: ${chapter}`),
      });
      return { content: parse(r.text), refused: r.refused, model: r.model, usage: r.usage };
    },
  };
}

// A different model solves blind than the one that wrote the questions, as with Claude (ADR-032).
export function geminiQuestions(f: typeof fetch = fetch): QuestionProvider {
  const maxOutput = 16_000;
  const run = async (model: GeminiModel, system: string, content: string, schema: z.ZodType) => {
    const r = await call(f, model, { system, maxOutput, schema, contents: user(content) });
    return { content: parse(r.text), refused: r.refused, usage: r.usage };
  };
  return {
    author: 'gemini-3.8-flash',
    solver: 'gemini-3.5-flash-lite',
    maxOutput,
    write: ({ chapter, sources, system }) =>
      run('gemini-3.8-flash', system, writeMessage(chapter, sources), DRAFT_SCHEMA),
    solve: ({ questions, sources, system }) =>
      run('gemini-3.5-flash-lite', system, solveMessage(questions, sources), SOLVE_SCHEMA),
  };
}

export function geminiNotes(f: typeof fetch = fetch): NotesProvider {
  const model = 'gemini-3.8-flash';
  const maxOutput = 16_000;
  return {
    model,
    maxOutput,
    async write({ topic, subtopic, explanation, system }) {
      const r = await call(f, model, { system, maxOutput, contents: user(notesMessage(topic, subtopic, explanation)) });
      return { markdown: r.text, refused: r.refused, usage: r.usage };
    },
  };
}

export function geminiPlan(f: typeof fetch = fetch): PlanProvider {
  const model = 'gemini-3.5-flash-lite';
  const maxOutput = 4_000;
  return {
    model,
    maxOutput,
    async plan({ request, topics, system }) {
      const r = await call(f, model, {
        system,
        maxOutput,
        schema: PLAN_SCHEMA,
        contents: user(planMessage(request, topics)),
      });
      return { content: parse(r.text), refused: r.refused, usage: r.usage };
    },
  };
}
