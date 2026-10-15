import { toCsv } from '@/lib/assess';
import { supabase } from '@/lib/supabase';
import { currentInstitute, currentMember, isUuid, STAFF } from '@/lib/tenant';
import { standingRows } from '../standings';

// Batch rank list as CSV. RLS returns standings only to staff who teach the batch (or owner/admin).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [institute, member] = await Promise.all([currentInstitute(), currentMember()]);
  if (!institute || institute.status === 'suspended' || !member?.role || !STAFF.includes(member.role) || !isUuid(id))
    return new Response('Not found', { status: 404 });
  const db = await supabase();
  const { data: batch } = await db
    .from('batches')
    .select('name')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!batch) return new Response('Not found', { status: 404 });
  const { rows, lastTitle } = await standingRows(db, id);
  rows.sort((a, b) => (a.overall_rank ?? 1e9) - (b.overall_rank ?? 1e9) || a.name.localeCompare(b.name));
  const csv = toCsv([
    [
      'Overall rank',
      'Student',
      'Average %',
      'Tests counted',
      'Tests missed',
      `Last test %${lastTitle ? ` (${lastTitle})` : ''}`,
    ],
    ...rows.map((r) => [r.overall_rank, r.name, r.average_percentage, r.tests_counted, r.tests_missed, r.last]),
  ]);
  const file = `${batch.name.replace(/[^\w -]+/g, '').trim() || 'batch'} ranks.csv`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'private, no-store',
    },
  });
}
