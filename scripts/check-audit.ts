// T-SEC-17 / gate G4: no high/critical advisory unless it has a dated exception. Production deps get no exceptions.
import { execSync } from 'node:child_process';

type Audit = { vulnerabilities?: Record<string, { via: (string | { url: string; severity: string })[] }> };

// Dev/lint-time only; each entry needs a reason and an expiry (re-review on or before that date).
export const exceptions: Record<string, { reason: string; expires: string }> = {
  'GHSA-vfj7-8cjw-p6xm': {
    reason: 'braces DoS via eslint-config-next (lint only, patterns are our own source globs); no patched release',
    expires: '2027-01-15',
  },
};

export function blocking(audit: Audit, today: string, allowed: typeof exceptions = exceptions) {
  const ids = Object.values(audit.vulnerabilities ?? {})
    .flatMap((v) => v.via)
    .filter((x) => typeof x !== 'string' && ['high', 'critical'].includes(x.severity))
    .map((x) => (x as { url: string }).url.split('/').pop()!);
  return [...new Set(ids)].filter((id) => !(allowed[id] && allowed[id].expires >= today));
}

function audit(args: string): Audit {
  try {
    return JSON.parse(execSync(`npm audit --json ${args}`, { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse((e as { stdout: string }).stdout); // npm audit exits 1 when it finds anything
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const today = new Date().toISOString().slice(0, 10);
  const prod = blocking(audit('--omit=dev'), today, {});
  const all = blocking(audit(''), today);
  if (prod.length || all.length) {
    console.error(`check-audit: blocking advisories: ${[...new Set([...prod, ...all])].join(', ')}`);
    process.exit(1);
  }
  console.log('check-audit: ok');
}
