// The worker downloads queued files as its own Supabase Auth user (a "service account" listed in
// private.service_accounts). Storage policy lets it read only files of versions that are queued or processing;
// no secret key is used (ADR-005).
import { createClient } from '@supabase/supabase-js';

export async function workerDownloader(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !env.WORKER_STORAGE_EMAIL || !env.WORKER_STORAGE_PASSWORD) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, WORKER_STORAGE_EMAIL and WORKER_STORAGE_PASSWORD are required',
    );
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: env.WORKER_STORAGE_EMAIL,
    password: env.WORKER_STORAGE_PASSWORD,
  });
  if (error) throw new Error(`worker storage sign-in failed: ${error.message}`);
  return async (path: string) => {
    const { data, error } = await client.storage.from('documents').download(path);
    if (error) throw error;
    return new Uint8Array(await data.arrayBuffer());
  };
}
