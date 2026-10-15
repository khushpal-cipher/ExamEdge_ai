// Document ingestion job (AI_PIPELINE §3). Idempotent: the claim is atomic, and the final transaction replaces this
// version's chunks, promotes it unless a newer version is live, and drops every other version's chunks. Nothing
// becomes visible until that transaction commits, so a crash or failure keeps the previous version live.
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { embed, toVector } from '@examedge/core/ai/embed';
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

export async function ingestVersion(deps: Deps, job: Job): Promise<'ready' | 'failed' | 'skipped'> {
  const { rows } = await inTenant(deps.pool, job.institute_id, (c) =>
    c.query(
      `update public.document_versions set processing_status = 'processing', claimed_at = now()
       where id = $1 and (processing_status = 'queued'
         or (processing_status = 'processing' and claimed_at < now() - interval '30 minutes'))
       returning document_id, version, storage_path, mime`,
      [job.version_id],
    ),
  );
  const v = rows[0];
  if (!v) return 'skipped'; // already handled, or not a version of this institute
  try {
    const bytes = await deps.download(v.storage_path).catch(() => {
      throw new IngestError('file_missing');
    });
    const { pages, method } = await readPages(bytes, v.mime);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new IngestError('no_text');
    const { model, vectors } = await embed(
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
    const code = e instanceof IngestError ? e.code : 'internal';
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

export async function drain(deps: Deps) {
  const jobs = await pendingJobs(deps.pool);
  for (const job of jobs) await ingestVersion(deps, job);
  return jobs.length;
}
