import { cache } from 'react';
import { cookies } from 'next/headers';
import { requireMember } from './tenant';

// Batch switcher (ADR-040): the student's batches, current first, then past ones (newest first). The cookie only
// picks among the student's own batch_members rows; RLS still decides what every page reads.
export const BATCH_COOKIE = 'batch';
export type StudentBatch = { id: string; name: string; joinedAt: string; leftAt: string | null };

export const studentBatches = cache(async () => {
  const { institute, member, db } = await requireMember(['student']);
  const { data, error } = await db
    .from('batch_members')
    .select('batch_id, created_at, left_at, batches(name)')
    .eq('institute_id', institute.id)
    .eq('membership_id', member.id)
    .eq('batch_role', 'student');
  if (error) throw error;
  const list: StudentBatch[] = (data ?? [])
    .map((r) => ({
      id: r.batch_id,
      name: (r.batches as unknown as { name: string }).name,
      joinedAt: r.created_at,
      leftAt: r.left_at,
    }))
    .sort((a, b) => Number(!!a.leftAt) - Number(!!b.leftAt) || (b.leftAt ?? '').localeCompare(a.leftAt ?? ''));
  const picked = (await cookies()).get(BATCH_COOKIE)?.value;
  return { list, selected: list.find((b) => b.id === picked) ?? list[0] ?? null };
});

// Institute tests of one batch held while the student was in it (RLS: never drafts); same rule as their ranks.
export async function batchTests(batch: StudentBatch) {
  const { institute, db } = await requireMember(['student']);
  let q = db
    .from('tests')
    .select('id, title, status, opens_at, closes_at, test_audience!inner(batch_id)')
    .eq('institute_id', institute.id)
    .eq('test_audience.batch_id', batch.id)
    .neq('status', 'cancelled')
    .gt('closes_at', batch.joinedAt)
    .order('opens_at', { ascending: false });
  if (batch.leftAt) q = q.lt('opens_at', batch.leftAt);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
