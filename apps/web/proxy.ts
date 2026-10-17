import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hostname, isAdminHost } from './lib/host';

// Refreshes the Supabase session cookie (host-only, per subdomain) and maps the platform admin host onto /platform.
// Authorization is enforced by RLS and re-checked in every page and Server Function, never here.
export async function proxy(request: NextRequest) {
  const host = hostname(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  const path = request.nextUrl.pathname;
  // /platform is only reachable through the admin host, and the admin host only serves /platform.
  if (!isAdminHost(host) && (path === '/platform' || path.startsWith('/platform/'))) {
    return new NextResponse(null, { status: 404 });
  }
  // /auth/callback is shared by every host, including the admin host.
  const target =
    isAdminHost(host) && path !== '/auth/callback'
      ? new URL(`/platform${path === '/' ? '' : path}`, request.url)
      : null;
  if (target) target.search = request.nextUrl.search;
  const respond = () => (target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request }));

  let response = respond();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = respond();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );
  await db.auth.getClaims();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'] };
