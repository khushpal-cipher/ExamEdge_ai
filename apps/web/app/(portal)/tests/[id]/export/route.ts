import { pct, toCsv } from '@/lib/assess';
import { currentInstitute, currentMember, isUuid, STAFF } from '@/lib/tenant';
import { supabase } from '@/lib/supabase';

// Rank list as CSV (opens in Excel). Staff only; RLS limits teachers to students of their own batches.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [institute, member] = await Promise.all([currentInstitute(), currentMember()]);
  if (!institute || institute.status === 'suspended' || !member?.role || !STAFF.includes(member.role) || !isUuid(id))
    return new Response('Not found', { status: 404 });
  const db = await supabase();
  const { data: test } = await db
    .from('tests')
    .select('title, cbt')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!test) return new Response('Not found', { status: 404 });
  const [{ data: attempts }, { data: profiles }] = await Promise.all([
    db
      .from('test_attempts')
      .select('user_id, score, max_score, rank, percentile, started_at, submitted_at, status, cbt_warnings')
      .eq('institute_id', institute.id)
      .eq('test_id', id)
      .order('rank'),
    db.from('profiles').select('user_id, full_name'),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? '']));
  const csv = toCsv([
    [
      'Rank',
      'Student',
      'Score',
      'Max',
      'Percentage',
      'Percentile',
      'Minutes taken',
      'Submitted',
      ...(test.cbt ? ['CBT warnings'] : []),
    ],
    ...(attempts ?? []).map((a) => [
      a.rank,
      name.get(a.user_id),
      a.score,
      a.max_score,
      pct(a.score, a.max_score),
      a.percentile,
      a.submitted_at ? Math.round((Date.parse(a.submitted_at) - Date.parse(a.started_at)) / 60000) : null,
      a.status === 'auto_submitted' ? 'auto' : 'yes',
      ...(test.cbt ? [a.cbt_warnings] : []),
    ]),
  ]);
  const file = `${test.title.replace(/[^\w -]+/g, '').trim() || 'test'} results.csv`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'private, no-store',
    },
  });
}
