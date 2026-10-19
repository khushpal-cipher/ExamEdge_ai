// Static security checks (T-SEC-08 and CLAUDE.md rules) that ESLint cannot express simply.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type Rule = { id: string; pattern: RegExp; applies: (path: string) => boolean };

const inWorkerRuntime = (p: string) => p.startsWith('apps/worker/') || p.startsWith('packages/core/');
const inRuntime = (p: string) => p.startsWith('apps/') || p.startsWith('packages/');

export const rules: Rule[] = [
  { id: 'session-set_config', pattern: /set_config\s*\([^)]*,\s*false\s*\)/i, applies: inWorkerRuntime },
  {
    id: 'session-SET',
    pattern: /[`'"]\s*set\s+(?!local\b)(session\s+)?(role\b|[a-z_."]+\s*(=|to\b))/i,
    applies: inWorkerRuntime,
  },
  {
    id: 'provider-sdk-outside-gateway',
    pattern:
      /(from\s+|import\s*\(|require\s*\()\s*['"](@anthropic-ai\/sdk|voyageai|openai|@google\/genai)['"/]|api\.(anthropic|voyageai)\.com|generativelanguage\.googleapis\.com/,
    applies: (p) => inRuntime(p) && !p.startsWith('packages/core/src/ai/'),
  },
  { id: 'dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML/, applies: (p) => p.startsWith('apps/web/') },
  { id: 'secret-key-in-runtime', pattern: /SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|sb_secret_/, applies: inRuntime },
];

export function findViolations(path: string, text: string) {
  return rules.filter((r) => r.applies(path) && r.pattern.test(text)).map((r) => r.id);
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', 'dist'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.ts$/.test(name)) yield full;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  let failed = 0;
  for (const dir of ['apps', 'packages']) {
    for (const file of walk(join(root, dir))) {
      const path = relative(root, file);
      for (const id of findViolations(path, readFileSync(file, 'utf8'))) {
        console.error(`${path}: forbidden pattern [${id}]`);
        failed++;
      }
    }
  }
  if (failed) process.exit(1);
  console.log('check-forbidden: ok');
}
