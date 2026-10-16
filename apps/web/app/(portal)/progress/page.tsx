import { requireMember } from '@/lib/tenant';
import { ProgressView, type Doubts, type Progress } from '../progress-view';

export default async function MyProgress() {
  const { institute, member, db } = await requireMember(['student']);
  const args = { inst: institute.id, student: member.userId };
  const [{ data, error }, { data: doubts, error: doubtsError }] = await Promise.all([
    db.rpc('student_progress', args),
    db.rpc('tutor_activity', args),
  ]);
  if (error || doubtsError) throw error ?? doubtsError;
  return (
    <>
      <div className="top">
        <h1>My progress</h1>
      </div>
      <ProgressView p={data as Progress} staff={false} doubts={doubts as Doubts} />
    </>
  );
}
