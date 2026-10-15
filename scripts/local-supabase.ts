// Ops/seed scripts ONLY. Reads the local stack's settings from the Supabase CLI and refuses anything non-local,
// so the secret key never leaves this machine and is never written to a file.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

export function localSupabase() {
  const env: Record<string, string> = {};
  for (const line of execSync('supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).split('\n')) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line);
    if (m) env[m[1]!] = m[2]!;
  }
  const url = env.API_URL ?? '';
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('refusing: Supabase is not local');
  return {
    env,
    admin: createClient(url, env.SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }),
    db: new pg.Client({ connectionString: env.DB_URL }),
  };
}

// LOCAL worker service account: the worker signs in as this user to download queued files (storage policy +
// private.service_accounts). Local-only password, like DEMO_PASSWORD; a cloud project gets its own via ops.
export const LOCAL_WORKER = { email: 'worker@examedge.test', password: 'examedge-worker-local' };

export async function ensureWorkerAccount(admin: ReturnType<typeof localSupabase>['admin'], db: pg.Client) {
  const { error } = await admin.auth.admin.createUser({ ...LOCAL_WORKER, email_confirm: true });
  if (error && error.code !== 'email_exists') throw new Error(`worker account: ${error.message}`);
  await db.query(
    `insert into private.service_accounts (user_id, kind) select id, 'worker' from auth.users where email = $1
     on conflict do nothing`,
    [LOCAL_WORKER.email],
  );
}

// Settings for the worker processes started by seed/tests on this machine.
export function localWorkerEnv(env: Record<string, string>) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.PUBLISHABLE_KEY,
    WORKER_STORAGE_EMAIL: LOCAL_WORKER.email,
    WORKER_STORAGE_PASSWORD: LOCAL_WORKER.password,
    WORKER_DATABASE_URL:
      process.env.WORKER_DATABASE_URL ?? 'postgresql://worker:worker_local_only@127.0.0.1:54322/postgres',
  };
}
