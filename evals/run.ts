// Retrieval eval (AI_PIPELINE §4 "Evaluation", TEST_STRATEGY §5). Runs the golden set against the local seeded
// "Demo Classes" as real students through PostgREST (rpc match_chunks, RLS applies) and writes
// evals/results/<date>-<change>.json. Usage: `npm run seed:demo && npm run eval -- <change-name>`.
// Demo mode only measures the pipeline with fake embeddings; the AC6.1 threshold needs real embeddings and the pilot's
// golden set (BLOCKED). Questions with title null are out of scope: they must not count as hits, only report scores.
// Phase 8: the tutor's real top 8 is both layers merged (mergeLayers: ≤ 6 per layer), so hits are measured on that
// list. Questions with a `topic` must find that ExamEdge library topic (AC8.4: library recall@8 ≥ 0.85).
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { embeddingProvider, fakeEmbedding, toVector } from '../packages/core/src/ai/embed';
import { mergeLayers, PROMPT_VERSION, type Passage } from '../packages/core/src/ai/tutor';
import { localSupabase } from '../scripts/local-supabase';

type Item = { q: string; subject: string; title: string | null; page: number | null; topic?: string };
type Row = {
  institute_id: string;
  document_id: string;
  page_start: number;
  page_end: number;
  content: string;
  similarity: number;
  score: number;
};
type LibRow = { item_id: string; topic: string; content: string; similarity: number; score: number };

const K = 8;
const change = process.argv[2] ?? 'demo';
const items = JSON.parse(readFileSync(new URL('./datasets/demo-retrieval.json', import.meta.url), 'utf8')) as Item[];
const { env, db } = localSupabase();

async function student(email: string) {
  const c = createClient(env.API_URL!, env.PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`${email}: ${error.message} (run npm run seed:demo first)`);
  return c;
}

await db.connect();
const inst = (await db.query(`select id from public.institutes where slug = 'demo'`)).rows[0]?.id as string;
const ids = (sql: string) => db.query(sql, [inst]).then((r) => new Map(r.rows.map((x) => [x.name, x.id as string])));
const subjects = await ids('select name, id from public.subjects where institute_id = $1');
const titles = await ids('select id as name, title as id from public.documents where institute_id = $1');
const library = await ids('select name, library_subject_id as id from public.subjects where institute_id = $1');
await db.end();
// student01 is in JEE (Physics, Chemistry, Maths); student26 in NEET (Physics, Chemistry, Biology).
const jee = await student('student01@demo.test');
const neet = await student('student26@demo.test');

const runs = [];
for (const it of items) {
  const who = it.subject === 'Biology' ? neet : jee;
  const t0 = performance.now();
  const query = { query_embedding: toVector(fakeEmbedding(it.q)), query_text: it.q };
  const lib = library.get(it.subject);
  const [notes, libs] = await Promise.all([
    who.rpc('match_chunks', { ...query, subject: subjects.get(it.subject), k: 30 }),
    lib ? who.rpc('match_library_chunks', { ...query, subject: lib, k: 20 }) : { data: [], error: null },
  ]);
  const ms = performance.now() - t0;
  if (notes.error) throw notes.error;
  if (libs.error) throw libs.error;
  const rows = notes.data as Row[];
  const top = mergeLayers(
    rows.map((r) => ({ ...r, source_kind: 'institute' as const, title: titles.get(r.document_id) ?? '' })),
    (libs.data as LibRow[]).map((r) => ({
      ...r,
      source_kind: 'library' as const,
      library_item_id: r.item_id,
      title: r.topic,
    })),
  ) as (Passage & { similarity: number })[];
  const hit =
    it.title !== null &&
    top.some(
      (p) => p.source_kind !== 'library' && p.title === it.title && p.page_start <= it.page! && it.page! <= p.page_end,
    );
  const libraryHit = it.topic !== undefined && top.some((p) => p.source_kind === 'library' && p.title === it.topic);
  const leaks = rows.filter((r) => r.institute_id !== inst).length;
  runs.push({ ...it, hit, libraryHit, leaks, ms: Math.round(ms), top_similarity: top[0]?.similarity ?? null });
}

const inScope = runs.filter((r) => r.title !== null);
const libScope = runs.filter((r) => r.topic !== undefined);
const pct = (xs: number[], p: number) => xs.sort((a, b) => a - b)[Math.ceil((p / 100) * xs.length) - 1] ?? 0;
const ms = runs.map((r) => r.ms);
const result = {
  date: new Date().toISOString(),
  change,
  dataset: 'evals/datasets/demo-retrieval.json',
  embedding_model: embeddingProvider().model,
  prompt_version: PROMPT_VERSION,
  k: K,
  questions: runs.length,
  in_scope: inScope.length,
  recall_at_8: Number((inScope.filter((r) => r.hit).length / inScope.length).toFixed(3)),
  library_in_scope: libScope.length,
  library_recall_at_8: Number((libScope.filter((r) => r.libraryHit).length / libScope.length).toFixed(3)),
  cross_tenant_rows: runs.reduce((n, r) => n + r.leaks, 0),
  retrieval_ms: { p50: pct(ms, 50), p95: pct(ms, 95) },
  cost_micro_usd: 0,
  misses: inScope.filter((r) => !r.hit).map((r) => r.q),
  library_misses: libScope.filter((r) => !r.libraryHit).map((r) => r.q),
  runs,
};
const file = `evals/results/${result.date.slice(0, 10)}-${change}.json`;
writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log(
  `recall@${K} ${result.recall_at_8} (${inScope.length} in scope), library recall@${K} ${result.library_recall_at_8} ` +
    `(${libScope.length} in scope), cross-tenant rows ${result.cross_tenant_rows},`,
);
console.log(`retrieval p50 ${result.retrieval_ms.p50} ms, p95 ${result.retrieval_ms.p95} ms → ${file}`);
if (result.cross_tenant_rows > 0) process.exit(1);
