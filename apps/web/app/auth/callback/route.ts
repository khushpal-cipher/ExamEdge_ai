import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@examedge/core/demo';
import { log } from '@examedge/core/log';
import { supabase } from '@/lib/supabase';

// Google sign-in lands here with a one-time code; exchanging it sets the session cookie for this host.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const { error } = code ? await (await supabase()).auth.exchangeCodeForSession(code) : { error: { code: 'no_code' } };
  if (error) log.error('auth.google_callback_failed', { code: error.code });
  // request.url carries the dev server's own hostname; the session cookie belongs to the institute host.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  const target = new URL(error ? `/?error=signin` : next, `${proto}://${host}`);
  return NextResponse.redirect(target, { headers: { 'cache-control': 'private, no-store' } });
}
