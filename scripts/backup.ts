// Ops: independent backup (database dump + copy of every Storage file) and a restore rehearsal (T-OPS-16, ADR-029,
// docs/RUNBOOKS.md). Storage files are not in Supabase's database backups, so both halves are needed.
//   npm run backup                       → backups/<time>/{db.dump, storage/<bucket>/<object>, manifest.json}
//   npm run restore-drill -- <backup dir> → restores into a scratch database, compares row counts with the manifest,
//                                           checks every file's checksum against the restored rows, prints the time.
// shortcut: local stack only (localSupabase refuses anything else, the drill restores inside the local DB container);
// the production backup and the real G7 drill into a scratch project wait for the production project (BLOCKED).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { localSupabase } from './local-supabase';

const PG_DUMP = process.env.PG_DUMP ?? '/opt/homebrew/opt/postgresql@17/bin/pg_dump'; // must match the server major
const CONTAINER = 'supabase_db_examedge_ai';
const SCHEMAS = ['public', 'private', 'auth', 'storage'];
const BUCKETS = ['documents', 'logos'];
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

type Manifest = {
  created_at: string;
  row_counts: Record<string, number>;
  files: { bucket: string; name: string; bytes: number; sha256: string }[];
};

async function rowCounts(db: pg.Client) {
  const { rows } = await db.query(
    `select quote_ident(schemaname) || '.' || quote_ident(tablename) as t from pg_tables
     where schemaname = any($1) order by 1`,
    [SCHEMAS],
  );
  const counts: Record<string, number> = {};
  for (const { t } of rows) counts[t] = Number((await db.query(`select count(*) from ${t}`)).rows[0].count);
  return counts;
}

async function backup() {
  const { env, admin, db } = localSupabase();
  const created_at = new Date().toISOString();
  const dir = path.join('backups', created_at.replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  await db.connect();
  try {
    // shortcut: counts are taken just before the dump, not in its snapshot; fine for a quiet database.
    const row_counts = await rowCounts(db);
    execFileSync(PG_DUMP, ['-Fc', '-f', path.join(dir, 'db.dump'), env.DB_URL!]);
    const files: Manifest['files'] = [];
    const { rows } = await db.query(
      'select bucket_id, name from storage.objects where bucket_id = any($1) order by 1, 2',
      [BUCKETS],
    );
    for (const o of rows) {
      if (o.name.split('/').some((p: string) => p === '..' || p === '')) throw new Error(`unsafe object name`);
      const { data, error } = await admin.storage.from(o.bucket_id).download(o.name);
      if (error) throw error;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const file = path.join(dir, 'storage', o.bucket_id, o.name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, bytes);
      files.push({ bucket: o.bucket_id, name: o.name, bytes: bytes.length, sha256: sha256(bytes) });
    }
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ created_at, row_counts, files }, null, 2) + '\n');
    console.log(`Backup ${dir}: ${Object.keys(row_counts).length} tables, ${files.length} files.`);
  } finally {
    await db.end();
  }
}

async function drill(dir: string, keep: boolean) {
  const started = Date.now();
  const manifest: Manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  // As supabase_admin inside the container: only it may own Supabase's own schemas (auth, storage), so the restore
  // keeps every owner and grant exactly.
  const admin = (args: string[], input?: Buffer) =>
    execFileSync('docker', ['exec', '-i', CONTAINER, ...args], { input, stdio: ['pipe', 'ignore', 'inherit'] });
  admin(['psql', '-U', 'supabase_admin', '-d', 'postgres', '-qc', 'drop database if exists restore_drill']);
  admin(['psql', '-U', 'supabase_admin', '-d', 'postgres', '-qc', 'create database restore_drill']);
  admin(
    ['pg_restore', '-U', 'supabase_admin', '--exit-on-error', '-d', 'restore_drill'],
    readFileSync(path.join(dir, 'db.dump')),
  );

  const db = new pg.Client({ connectionString: localSupabase().env.DB_URL!.replace(/\/postgres$/, '/restore_drill') });
  await db.connect();
  const problems: string[] = [];
  let hashed = 0;
  try {
    const restored = await rowCounts(db);
    for (const [t, n] of Object.entries(manifest.row_counts)) {
      if (restored[t] !== n) problems.push(`${t}: ${restored[t] ?? 'missing'} rows, backup had ${n}`);
    }
    const byPath = new Map(manifest.files.map((f) => [`${f.bucket}/${f.name}`, f]));
    for (const f of manifest.files) {
      if (sha256(readFileSync(path.join(dir, 'storage', f.bucket, f.name))) !== f.sha256) {
        problems.push(`file changed since backup: ${f.bucket}/${f.name}`);
      }
    }
    // The worker stored each processed file's checksum: the restored rows and the copied files must agree.
    const { rows } = await db.query(
      'select storage_path, sha256 from public.document_versions where sha256 is not null',
    );
    for (const v of rows) {
      const f = byPath.get(`documents/${v.storage_path}`);
      if (f?.sha256 !== v.sha256) problems.push(`document file missing or different: ${v.storage_path}`);
      else hashed++;
    }
  } finally {
    await db.end();
    if (!keep) admin(['psql', '-U', 'supabase_admin', '-d', 'postgres', '-qc', 'drop database restore_drill']);
  }
  const rows = Object.values(manifest.row_counts).reduce((a, b) => a + b, 0);
  console.log(
    `Restore drill ${dir}: ${Object.keys(manifest.row_counts).length} tables / ${rows} rows compared, ` +
      `${manifest.files.length} files checked, ${hashed} document checksums matched the restored rows, ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s.`,
  );
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

const [command, dir] = process.argv.slice(2);
if (command === 'backup') await backup();
else if (command === 'drill' && dir) await drill(dir, process.argv.includes('--keep'));
else throw new Error('usage: backup.ts backup | backup.ts drill <backup dir> [--keep]');
