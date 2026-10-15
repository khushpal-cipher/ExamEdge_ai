import { cache } from 'react';
import { headers } from 'next/headers';
import { supabase } from './supabase';

export type Institute = { id: string; slug: string; name: string; status: string; branding: Record<string, unknown> };
export type Member = { userId: string; role: string | null };

// The institute always comes from the Host header via the database, never from the browser (TH-04).
export const hostname = (host: string | null) => (host ?? '').split(',')[0]!.trim().split(':')[0]!.toLowerCase();
export const isRootHost = (host: string) => host === (process.env.ROOT_HOST ?? 'localhost');

// Next (dev server actions) and Vercel put the client's host in x-forwarded-host. A spoofed value only picks the
// context: RLS still requires membership, and the host-only session cookie belongs to the host actually visited.
export const currentHost = cache(async () => {
  const h = await headers();
  return hostname(h.get('x-forwarded-host') ?? h.get('host'));
});

export const currentInstitute = cache(async (): Promise<Institute | null> => {
  const db = await supabase();
  const { data, error } = await db.rpc('resolve_institute', { host: await currentHost() }).maybeSingle();
  if (error) throw error;
  return data as Institute | null;
});

// Signed-in user and their active role in the current institute (null role = not a member).
export const currentMember = cache(async (): Promise<Member | null> => {
  const db = await supabase();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims.sub;
  const institute = await currentInstitute();
  if (!userId || !institute) return null;
  const { data: m } = await db
    .from('memberships')
    .select('role')
    .eq('institute_id', institute.id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return { userId, role: m?.role ?? null };
});
