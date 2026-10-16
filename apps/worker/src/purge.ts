// Daily purge (ADR-029, ADR-031). Files nobody can reach any more go first, through the Storage API as the worker
// account (the storage policies re-check every one); then purge_expired drops expired rows, including deleted
// documents whose files are gone. Logs counts only.
import type pg from 'pg';
import type { workerStorage } from './storage';

export async function purge(pool: pg.Pool, storage: Awaited<ReturnType<typeof workerStorage>>) {
  const { rows } = await pool.query<{ bucket: string; name: string }>(
    'select bucket, name from private.purgeable_files()',
  );
  let files = 0;
  for (const bucket of ['documents', 'logos']) {
    const names = rows.filter((r) => r.bucket === bucket).map((r) => r.name);
    for (let i = 0; i < names.length; i += 100) {
      const { data, error } = await storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) throw error;
      files += data.length;
    }
  }
  const { n } = (await pool.query('select private.purge_expired() as n')).rows[0];
  return { files, ...n } as Record<string, number>;
}
