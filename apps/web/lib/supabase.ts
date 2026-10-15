import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// One client per request, always with the user's session: RLS decides what it can read (ADR-005).
export async function supabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
