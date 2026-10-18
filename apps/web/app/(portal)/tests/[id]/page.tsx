import { notFound } from 'next/navigation';
import { isUuid, requireMember } from '@/lib/tenant';
import { Flash } from '../../flash';
import { StaffTest, type Test } from './staff-test';
import { StudentTest } from './student-test';

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await requireMember();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // RLS: staff see tests they may manage or that target their batches; students only scheduled tests of their batch.
  const { data: test } = await ctx.db
    .from('tests')
    .select('id, title, status, opens_at, closes_at, duration_seconds, shuffle_questions, cbt, created_by, subject_id')
    .eq('institute_id', ctx.institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!test) notFound();
  if (ctx.member.role === 'student')
    return <StudentTest ctx={ctx} test={test as Test} error={(await searchParams).error} />;
  return (
    <>
      <Flash searchParams={searchParams} />
      <StaffTest ctx={ctx} test={test as Test} />
    </>
  );
}
