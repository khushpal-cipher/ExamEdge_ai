// ADR-031 against the local stack: the daily purge deletes, through the real Storage API as the worker account, the
// files of a document deleted more than 30 days ago and an unused logo, then drops that document; live files stay.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ensureWorkerAccount, localSupabase, localWorkerEnv } from '../../../scripts/local-supabase';
import { purge } from './purge';
import { workerStorage } from './storage';

const { env, admin, db } = localSupabase();
const workerEnv = localWorkerEnv(env);
const slug = `prg${Date.now() % 1e9}`;
let inst: string;
let pool: pg.Pool;
const created: Record<string, string[]> = { documents: [], logos: [] };

// A ready document with one uploaded file, its object made two days old (purge never takes newer files).
async function document(title: string) {
  const doc = (
    await db.query(
      `insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title)
       select $1, st.subject_id, st.chapter_id, st.id, $2 from public.subtopics st
       join public.subjects s on s.id = st.subject_id where st.institute_id = $1 and s.name = 'Physics' returning id`,
      [inst, title],
    )
  ).rows[0].id as string;
  const v = randomUUID();
  const path = `${inst}/${doc}/${v}`;
  await db.query(
    `insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes)
     values ($1, $2, $3, 1, $4, 'application/pdf', 4)`,
    [v, inst, doc, path],
  );
  created.documents!.push(path);
  const { error } = await admin.storage
    .from('documents')
    .upload(path, Buffer.from('%PDF'), { contentType: 'application/pdf' });
  if (error) throw error;
  return { doc, path };
}
const age = (name: string) =>
  db.query(`update storage.objects set created_at = now() - interval '2 days' where name = $1`, [name]);
const exists = async (bucket: string, name: string) =>
  (await db.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rowCount === 1;

beforeAll(async () => {
  await db.connect();
  await ensureWorkerAccount(admin, db);
  inst = (await db.query('select tests.make_institute($1) as id', [slug])).rows[0].id;
  pool = new pg.Pool({ connectionString: workerEnv.WORKER_DATABASE_URL, max: 2 });
});

afterAll(async () => {
  // Leave no aged files behind: once the institute is gone they would be purgeable orphans in the local database.
  for (const [bucket, names] of Object.entries(created)) await admin.storage.from(bucket).remove(names);
  await db.query('delete from public.institutes where slug = $1', [slug]);
  await pool?.end();
  await db.end();
});

it('purges deleted documents after 30 days and unused logos, keeps everything else', async () => {
  const gone = await document('Deleted long ago');
  const recent = await document('Deleted last week');
  const live = await document('Live');
  await db.query(`update public.documents set deleted_at = now() - interval '31 days' where id = $1`, [gone.doc]);
  await db.query(`update public.documents set deleted_at = now() - interval '7 days' where id = $1`, [recent.doc]);
  const [oldLogo, logo] = [`${inst}/${randomUUID()}`, `${inst}/${randomUUID()}`];
  for (const name of [oldLogo, logo]) {
    created.logos!.push(name);
    const { error } = await admin.storage.from('logos').upload(name, Buffer.from('png'), { contentType: 'image/png' });
    if (error) throw error;
  }
  await db.query(`update public.institutes set branding = jsonb_build_object('logo', $2::text) where id = $1`, [
    inst,
    logo,
  ]);
  for (const name of [gone.path, recent.path, live.path, oldLogo, logo]) await age(name);

  const n = await purge(pool, await workerStorage(workerEnv));

  expect(n.files).toBeGreaterThanOrEqual(2);
  expect(n.documents).toBeGreaterThanOrEqual(1);
  expect(await exists('documents', gone.path)).toBe(false);
  expect(await exists('logos', oldLogo)).toBe(false);
  expect((await db.query('select 1 from public.documents where id = $1', [gone.doc])).rowCount).toBe(0);
  // Still there: a document inside its 30-day grace, a live one, the logo in use.
  expect(await exists('documents', recent.path)).toBe(true);
  expect(await exists('documents', live.path)).toBe(true);
  expect(await exists('logos', logo)).toBe(true);
  expect((await db.query('select 1 from public.documents where id = $1', [recent.doc])).rowCount).toBe(1);
});
