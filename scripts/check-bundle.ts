// T-SEC-11: the client bundle must not contain secret env names or secret-looking values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN =
  /sb_secret_|SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|service_role|ANTHROPIC_API_KEY|VOYAGE_API_KEY|WORKER_DATABASE_URL|sk-ant-/;
const dir = 'apps/web/.next/static';

function* walk(d: string): Generator<string> {
  for (const name of readdirSync(d)) {
    const full = join(d, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const hits = [...walk(dir)].filter((f) => FORBIDDEN.test(readFileSync(f, 'latin1')));
if (hits.length) {
  console.error('Client bundle contains forbidden secret patterns:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('check-bundle: ok');
