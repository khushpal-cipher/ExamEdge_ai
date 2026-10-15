// Development-only "Sign in as demo user" (ADR-020). Seeded local users share this password; it can never be
// used against a cloud project because demo sign-in requires the Supabase URL to be this machine.
export const DEMO_PASSWORD = 'examedge-demo-local';

export function demoLoginAllowed(env: Record<string, string | undefined>) {
  if (env.DEMO_LOGIN_ENABLED !== 'true' || !env.NEXT_PUBLIC_SUPABASE_URL) return false;
  try {
    return ['127.0.0.1', 'localhost'].includes(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}

// Same-origin path for post-login redirects; blocks //evil.com and /\evil.com (browsers treat both as hosts).
export function safeNext(next: unknown) {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/';
}
