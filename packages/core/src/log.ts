// JSON line logger. Never log PII or prompt text: sensitive keys are dropped and emails masked.
const SENSITIVE_KEY = /email|name|phone|prompt|content|text|answer|password|token|secret|key|details|hint/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

type Fields = Record<string, unknown>;

export function scrub(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(EMAIL, '[email]');
  if (value instanceof Error) return { error: value.name, message: scrub(value.message) };
  if (!value || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[redacted]' : scrub(v, depth + 1)]),
  );
}

function write(level: 'info' | 'warn' | 'error', msg: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...(scrub(fields) as Fields) });
  (level === 'error' ? console.error : console.log)(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};
