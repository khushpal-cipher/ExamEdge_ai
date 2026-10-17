// AC4.1 fixture suite, AC4.2 idempotency, crash recovery, and T-ISO-08 at job level, against the local stack.
// The worker runs as the `worker` role and downloads with its service account, exactly as in production.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../../../scripts/make-pdf';
import { ensureWorkerAccount, localSupabase, localWorkerEnv } from '../../../scripts/local-supabase';
import { drain, ingestVersion, type Deps } from './ingest';
import { workerDownloader } from './storage';

const { env, admin, db } = localSupabase();
const workerEnv = localWorkerEnv(env);
const slug = `ing${Date.now() % 1e9}`;
const other = `${slug}b`;
let deps: Deps;
let inst: string;
let subject: string;

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a80000000049454e44ae426082',
  'hex',
);
const english = (n: number) =>
  Array.from({ length: n }, (_, p) =>
    p === 0
      ? [
          'Chapter 7 Rotational Motion',
          ...Array.from({ length: 30 }, (_, i) => `Torque line ${i}: the turning effect of a force about an axis.`),
        ]
      : Array.from(
          { length: 30 },
          (_, i) => `Page ${p + 1} line ${i}: angular momentum is conserved without external torque.`,
        ),
  );

async function newDocument(title: string, institute = inst) {
  const { rows } = await db.query(
    `insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title)
     select $1, st.subject_id, st.chapter_id, st.id, $2 from public.subtopics st
     join public.subjects s on s.id = st.subject_id where st.institute_id = $1 and s.name = 'Physics' returning id`,
    [institute, title],
  );
  return rows[0].id as string;
}

// A queued version whose file was uploaded (or not, when bytes is null).
async function addVersion(doc: string, bytes: Buffer | null, mime = 'application/pdf', institute = inst) {
  const id = randomUUID();
  const path = `${institute}/${doc}/${id}`;
  const { rows } = await db.query(
    `insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes,
       processing_status)
     select $1, $2, $3, coalesce(max(version), 0) + 1, $4, $5, $6, 'queued' from public.document_versions
     where document_id = $3 returning id`,
    [id, institute, doc, path, mime, Math.max(bytes?.length ?? 1, 1)],
  );
  if (bytes) {
    const { error } = await admin.storage.from('documents').upload(path, bytes, { contentType: mime });
    if (error) throw error;
  }
  return rows[0].id as string;
}

const version = async (id: string) =>
  (await db.query('select * from public.document_versions where id = $1', [id])).rows[0];
const chunks = async (doc: string) =>
  (await db.query('select * from public.document_chunks where document_id = $1 order by chunk_index', [doc])).rows;
const ingest = (id: string, institute = inst) => ingestVersion(deps, { institute_id: institute, version_id: id });
const usage = async (job: string) =>
  (
    await db.query(
      `select feature, provider, outcome, institute_id from public.usage_records where job_id = $1 order by feature`,
      [job],
    )
  ).rows;

beforeAll(async () => {
  await db.connect();
  await ensureWorkerAccount(admin, db);
  inst = (await db.query('select tests.make_institute($1) as id', [slug])).rows[0].id;
  await db.query('select tests.make_institute($1)', [other]);
  subject = (await db.query(`select id from public.subjects where institute_id = $1 and name = 'Physics'`, [inst]))
    .rows[0].id;
  deps = {
    pool: new pg.Pool({ connectionString: workerEnv.WORKER_DATABASE_URL, max: 3 }),
    download: await workerDownloader(workerEnv),
  };
});

afterAll(async () => {
  await db.query('delete from public.institutes where slug in ($1, $2)', [slug, other]);
  await deps?.pool.end();
  await db.end();
});

describe('AC4.1 fixture files', () => {
  it('text PDF → ready from the text layer, chunked with pages and headings, promoted', async () => {
    const doc = await newDocument('Text notes');
    const v = await addVersion(doc, makePdf(english(3)));
    expect(await ingest(v)).toBe('ready');
    const row = await version(v);
    expect(row).toMatchObject({
      processing_status: 'ready',
      extraction_method: 'text_layer',
      page_count: 3,
      chunker_version: 1,
      embedding_model: 'fake-bow-1',
      error_code: null,
    });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    const cs = await chunks(doc);
    expect(cs.length).toBeGreaterThan(1);
    expect(cs[0]).toMatchObject({ subject_id: subject, page_start: 1, heading_path: 'Chapter 7 Rotational Motion' });
    expect(cs.at(-1).page_end).toBe(3);
    expect((await db.query('select current_version_id from public.documents where id = $1', [doc])).rows[0]).toEqual({
      current_version_id: v,
    });
    expect(await usage(v)).toEqual([{ feature: 'ingest_embed', provider: 'fake', outcome: 'ok', institute_id: inst }]);
  });

  it('scanned PDF (no text layer) → OCR', async () => {
    const doc = await newDocument('Scanned notes');
    const v = await addVersion(doc, makePdf([null, null]));
    expect(await ingest(v)).toBe('ready');
    expect(await version(v)).toMatchObject({ extraction_method: 'ocr', page_count: 2 });
    expect((await chunks(doc))[0].content).toContain('Scanned page 1');
    expect((await usage(v)).map((u) => `${u.feature}:${u.outcome}`)).toEqual(['ingest_embed:ok', 'ingest_ocr:ok']);
  });

  it('AI switched off for the institute → failed (ai_unavailable), the blocked call is recorded', async () => {
    await db.query('update public.institute_quotas set ai_enabled = false where institute_id = $1', [inst]);
    try {
      const doc = await newDocument('AI off');
      const v = await addVersion(doc, makePdf(english(1)));
      expect(await ingest(v)).toBe('failed');
      expect(await version(v)).toMatchObject({ error_code: 'ai_unavailable' });
      expect(await usage(v)).toEqual([
        { feature: 'ingest_embed', provider: 'fake', outcome: 'quota_blocked', institute_id: inst },
      ]);
    } finally {
      await db.query('update public.institute_quotas set ai_enabled = true where institute_id = $1', [inst]);
    }
  });

  it('text + scanned pages → mixed', async () => {
    const doc = await newDocument('Mixed notes');
    const v = await addVersion(doc, makePdf([english(1)[0]!, null]));
    expect(await ingest(v)).toBe('ready');
    expect(await version(v)).toMatchObject({ extraction_method: 'mixed' });
  });

  it('Hindi and formula-heavy PDFs keep their text', async () => {
    const doc = await newDocument('Hindi + formulas');
    const hindi = Array(6).fill('बल आघूर्ण किसी बल का घूर्णन प्रभाव है। कोणीय संवेग संरक्षित रहता है।');
    const formulas = Array(6).fill('τ = r × F,  L = Iω,  ∫ τ dt = ΔL,  KE = ½ I ω²,  a = α r,  √(2gh)');
    const v = await addVersion(doc, makePdf([hindi, formulas]));
    expect(await ingest(v)).toBe('ready');
    const text = (await chunks(doc)).map((c) => c.content).join('\n');
    expect(text).toContain('बल आघूर्ण किसी बल का घूर्णन प्रभाव है।');
    expect(text).toContain('τ = r × F');
    expect(text).toContain('KE = ½ I ω²');
  });

  it('garbled text layer with NUL characters → rendered and OCRed, not a crash', async () => {
    const doc = await newDocument('Garbled');
    const v = await addVersion(doc, makePdf([english(1)[0]!, ['\u0000\u0001'.repeat(40)]]));
    expect(await ingest(v)).toBe('ready');
    expect(await version(v)).toMatchObject({ extraction_method: 'mixed', page_count: 2 });
  });

  it('a photo (PNG) → OCR as one page', async () => {
    const doc = await newDocument('Photo');
    const v = await addVersion(doc, PNG, 'image/png');
    expect(await ingest(v)).toBe('ready');
    expect(await version(v)).toMatchObject({ extraction_method: 'ocr', page_count: 1 });
  });

  it.each([
    ['corrupt PDF', Buffer.from('%PDF-1.7\n1 0 obj garbage'), 'application/pdf', 'corrupt_file'],
    ['wrong magic bytes', Buffer.from('<html>not a pdf</html>'), 'application/pdf', 'wrong_file_type'],
    ['PNG bytes declared as JPEG', PNG, 'image/jpeg', 'wrong_file_type'],
    ['corrupt PNG', PNG.subarray(0, 20), 'image/png', 'corrupt_file'],
    ['301 pages', makePdf(Array(301).fill(['x'])), 'application/pdf', 'too_many_pages'],
    ['file never uploaded', null, 'application/pdf', 'file_missing'],
  ])('%s → failed (%s)', async (_name, bytes, mime, code) => {
    const doc = await newDocument(`Bad ${code}`);
    const v = await addVersion(doc, bytes, mime);
    expect(await ingest(v)).toBe('failed');
    expect(await version(v)).toMatchObject({ processing_status: 'failed', error_code: code });
    expect(await chunks(doc)).toEqual([]);
  });

  it('0-byte file → failed (empty_file)', async () => {
    const doc = await newDocument('Empty');
    const v = await addVersion(doc, Buffer.alloc(0));
    expect(await ingest(v)).toBe('failed');
    expect((await version(v)).error_code).toBe('empty_file');
  });
});

describe('versions, idempotency and failures', () => {
  let doc: string;
  let v1: string;
  let v2: string;

  it('AC4.2: a duplicate job for the same version is skipped; reprocessing gives the same chunks', async () => {
    doc = await newDocument('Versioned');
    v1 = await addVersion(doc, makePdf(english(2)));
    expect((await Promise.all([ingest(v1), ingest(v1)])).sort()).toEqual(['ready', 'skipped']);
    const first = await chunks(doc);
    await db.query(`update public.document_versions set processing_status = 'queued' where id = $1`, [v1]);
    expect(await ingest(v1)).toBe('ready');
    const again = await chunks(doc);
    expect(again.map((c) => [c.chunk_index, c.content])).toEqual(first.map((c) => [c.chunk_index, c.content]));
    expect(await ingest(v1)).toBe('skipped');
  });

  it('a new version replaces the old one atomically', async () => {
    v2 = await addVersion(doc, makePdf([['Version two only.', ...Array(10).fill('Fresh torque notes for v2.')]]));
    expect(await ingest(v2)).toBe('ready');
    const cs = await chunks(doc);
    expect(new Set(cs.map((c) => c.document_version_id))).toEqual(new Set([v2]));
    expect((await db.query('select current_version_id from public.documents where id = $1', [doc])).rows[0]).toEqual({
      current_version_id: v2,
    });
  });

  it('a failed newer version keeps the previous version live', async () => {
    const before = await chunks(doc);
    const v3 = await addVersion(doc, Buffer.from('%PDF-1.7 broken'));
    expect(await ingest(v3)).toBe('failed');
    expect(await chunks(doc)).toEqual(before);
    expect((await db.query('select current_version_id from public.documents where id = $1', [doc])).rows[0]).toEqual({
      current_version_id: v2,
    });
  });

  it('a worker that died mid-job: old version still served, the version is picked up again', async () => {
    const before = await chunks(doc);
    const v4 = await addVersion(doc, makePdf(english(1)));
    await db.query(
      `update public.document_versions set processing_status = 'processing', claimed_at = now() - interval '31 minutes'
       where id = $1`,
      [v4],
    );
    expect(await chunks(doc)).toEqual(before);
    expect(await drain(deps)).toBeGreaterThanOrEqual(1);
    expect(await version(v4)).toMatchObject({ processing_status: 'ready' });
    expect(new Set((await chunks(doc)).map((c) => c.document_version_id))).toEqual(new Set([v4]));
  });

  it('T-ISO-08: a job with institute A and a version of institute B does nothing', async () => {
    const otherInst = (await db.query('select id from public.institutes where slug = $1', [other])).rows[0].id;
    const bdoc = await newDocument('Other institute', otherInst);
    const bv = await addVersion(bdoc, makePdf(english(1)), 'application/pdf', otherInst);
    expect(await ingest(bv, inst)).toBe('skipped');
    expect(await version(bv)).toMatchObject({ processing_status: 'queued', claimed_at: null });
    expect(await chunks(bdoc)).toEqual([]);
    expect(await ingest(bv, otherInst)).toBe('ready');
  });
});

describe('per-institute limits (ADR-029)', () => {
  it('a file bigger than the size declared at upload start fails as too_large', async () => {
    const doc = await newDocument('Declared small');
    const v = await addVersion(doc, makePdf(english(1)));
    await db.query('update public.document_versions set size_bytes = 10 where id = $1', [v]);
    expect(await ingest(v)).toBe('failed');
    expect(await version(v)).toMatchObject({ processing_status: 'failed', error_code: 'too_large' });
  });

  it('max_concurrent_jobs: a job waits (stays queued) while the institute has no free slot', async () => {
    const doc = await newDocument('Concurrency');
    const running = await addVersion(doc, makePdf(english(1)));
    const waiting = await addVersion(doc, makePdf(english(1)));
    await db.query('update public.institute_quotas set max_concurrent_jobs = 1 where institute_id = $1', [inst]);
    await db.query(
      `update public.document_versions set processing_status = 'processing', claimed_at = now() where id = $1`,
      [running],
    );
    expect(await ingest(waiting)).toBe('skipped');
    expect(await version(waiting)).toMatchObject({ processing_status: 'queued', claimed_at: null });
    await db.query('update public.institute_quotas set max_concurrent_jobs = 2 where institute_id = $1', [inst]);
    expect(await ingest(waiting)).toBe('ready');
    await db.query(`update public.document_versions set processing_status = 'failed' where id = $1`, [running]);
  });
});
