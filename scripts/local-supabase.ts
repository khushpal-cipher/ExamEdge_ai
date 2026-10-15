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
