// Document ingestion job (AI_PIPELINE §3). Idempotent: the claim is atomic, and the final transaction replaces this
// version's chunks, promotes it unless a newer version is live, and drops every other version's chunks. Nothing
// becomes visible until that transaction commits, so a crash or failure keeps the previous version live.
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { embed, toVector } from '@examedge/core/ai/embed';
import { AiBlocked, type Meter } from '@examedge/core/ai/gateway';
import { OcrRefused } from '@examedge/core/ai/ocr';
import { log } from '@examedge/core/log';
import { chunkPages, CHUNKER_VERSION } from './chunk';
import { IngestError, readPages } from './extract';

export type Job = { institute_id: string; version_id: string };
export type Deps = { pool: pg.Pool; download: (path: string) => Promise<Uint8Array> };

// One tenant per transaction: the worker role's RLS shows only rows of app.institute_id (T-ISO-08). Never a session SET.
export async function inTenant<T>(pool: pg.Pool, institute: string, fn: (c: pg.PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.institute_id', $1, true)`, [institute]);
    const result = await fn(c);
    await c.query('commit');
    return result;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

// AI usage of one job, billed to the job's institute (ai_reserve_job reads it from the tenant context). Each
// reserve/settle is its own short transaction, so usage stays recorded when the ingest itself fails.
export const workerMeter = (pool: pg.Pool, institute: string, job: string): Meter => ({
  reserve: (feature, provider, model, microUsd) =>
    inTenant(pool, institute, async (c) => {
      const { rows } = await c.query(
        'select record_id as id, blocked from private.ai_reserve_job($1, $2, $3, $4, $5)',
        [feature, provider, model, microUsd, job],
      );
      return rows[0];
    }),
  settle: async (id, usage, microUsd, outcome) => {
    await inTenant(pool, institute, (c) =>
      c.query('select private.ai_settle_job($1, $2, $3, $4)', [id, usage, microUsd, outcome]),
    );
  },
});

export async function ingestVersion(deps: Deps, job: Job): Promise<'ready' | 'failed' | 'skipped'> {
  const rows = await inTenant(deps.pool, job.institute_id, async (c) => {
    // The institute's max_concurrent_jobs; when full the version stays queued and the next poll sends it again.
    if (!(await c.query('select private.job_slot_free() as free')).rows[0].free) return [];
    const claim = await c.query(
      `update public.document_versions set processing_status = 'processing', claimed_at = now()
       where id = $1 and (processing_status = 'queued'
         or (processing_status = 'processing' and claimed_at < now() - interval '30 minutes'))
       returning document_id, version, storage_path, mime, size_bytes`,
      [job.version_id],
    );
    return claim.rows;
  });
  const v = rows[0];
  if (!v) return 'skipped'; // already handled, not a version of this institute, or no free job slot
  try {
    const bytes = await deps.download(v.storage_path).catch(() => {
      throw new IngestError('file_missing');
    });
    // The upload limit was checked against the declared size; the real file must not be bigger.
    if (bytes.length > Number(v.size_bytes)) throw new IngestError('too_large');
    const meter = workerMeter(deps.pool, job.institute_id, job.version_id);
    const { pages, method } = await readPages(bytes, v.mime, meter);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new IngestError('no_text');
    const { model, vectors } = await embed(
      meter,
      'ingest_embed',
      chunks.map((c) => c.content),
      'document',
    );
    const rowsJson = JSON.stringify(chunks.map((c, i) => ({ ...c, embedding: toVector(vectors[i]!) })));
    await inTenant(deps.pool, job.institute_id, async (c) => {
      await c.query('delete from public.document_chunks where document_version_id = $1', [job.version_id]);
      await c.query(
        `insert into public.document_chunks (institute_id, document_id, document_version_id, subject_id, chunk_index,
           page_start, page_end, heading_path, content, embedding, token_count)
         select d.institute_id, d.id, $2, d.subject_id, x.chunk_index, x.page_start, x.page_end, x.heading_path,
           x.content, x.embedding::extensions.vector, x.token_count
         from public.documents d, jsonb_to_recordset($3::jsonb) as x(chunk_index int, page_start int, page_end int,
           heading_path text, content text, embedding text, token_count int)
         where d.id = $1`,
        [v.document_id, job.version_id, rowsJson],
      );
      await c.query(
        `update public.document_versions set processing_status = 'ready', error_code = null, sha256 = $2,
           page_count = $3, extraction_method = $4, chunker_version = $5, embedding_model = $6, processed_at = now()
         where id = $1`,
        [
          job.version_id,
          createHash('sha256').update(bytes).digest('hex'),
          pages.length,
          method,
          CHUNKER_VERSION,
          model,
        ],
      );
      await c.query(
        `update public.documents d set current_version_id = $2
         where d.id = $1 and (d.current_version_id is null
           or (select version from public.document_versions where id = d.current_version_id) < $3)`,
        [v.document_id, job.version_id, v.version],
      );
      await c.query(
        `delete from public.document_chunks c using public.documents d
         where d.id = $1 and c.document_id = d.id and c.document_version_id <> d.current_version_id`,
        [v.document_id],
      );
    });
    log.info('ingest.ready', { version_id: job.version_id, chunks: chunks.length, method });
    return 'ready';
  } catch (e) {
    const code =
      e instanceof IngestError
        ? e.code
        : e instanceof AiBlocked
          ? 'ai_unavailable'
          : e instanceof OcrRefused
            ? 'ocr_refused'
            : 'internal';
    if (code === 'internal') log.error('ingest.failed', { version_id: job.version_id, err: e });
    await inTenant(deps.pool, job.institute_id, (c) =>
      c.query(
        `update public.document_versions set processing_status = 'failed', error_code = $2, processed_at = now()
         where id = $1 and processing_status = 'processing'`,
        [job.version_id, code],
      ),
    );
    return 'failed';
  }
}

// Everything waiting right now (ids only, across tenants). The worker sends these through pg-boss; seed and tests
// process them directly.
export async function pendingJobs(pool: pg.Pool): Promise<Job[]> {
  return (await pool.query('select institute_id, version_id from private.pending_jobs()')).rows;
}

// Until nothing is waiting: pending_jobs hands out only max_concurrent_jobs per institute at a time.
export async function drain(deps: Deps) {
  let done = 0;
  for (let jobs = await pendingJobs(deps.pool); jobs.length; jobs = await pendingJobs(deps.pool)) {
    const results = [];
    for (const job of jobs) results.push(await ingestVersion(deps, job));
    done += jobs.length;
    if (results.every((r) => r === 'skipped')) break; // another worker holds the slots
  }
  return done;
}
