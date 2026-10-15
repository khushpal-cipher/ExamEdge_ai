import { requireMember } from '@/lib/tenant';
import { ProgressView, type Progress } from '../progress-view';

export default async function MyProgress() {
  const { institute, member, db } = await requireMember(['student']);
  const { data, error } = await db.rpc('student_progress', { inst: institute.id, student: member.userId });
  if (error) throw error;
  return (
    <>
      <div className="top">
        <h1>My progress</h1>
      </div>
      <ProgressView p={data as Progress} staff={false} />
    </>
  );
}
