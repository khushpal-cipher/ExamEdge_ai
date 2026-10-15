import { MANAGERS, type requireMember } from '@/lib/tenant';

// Batches the caller may target: managers all active batches, teachers the ones they teach.
export async function teachableBatches(
  db: Awaited<ReturnType<typeof requireMember>>['db'],
  institute: string,
  member: { id: string; role: string },
) {
  const { data: batches } = await db
    .from('batches')
    .select('id, name, batch_members(membership_id, batch_role)')
    .eq('institute_id', institute)
    .is('archived_at', null)
    .order('name');
  return (batches ?? []).filter(
    (b) =>
      MANAGERS.includes(member.role) ||
      (b.batch_members as { membership_id: string; batch_role: string }[]).some(
        (m) => m.membership_id === member.id && m.batch_role === 'teacher',
      ),
  );
}
