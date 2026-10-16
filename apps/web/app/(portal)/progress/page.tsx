import { requireMember } from '@/lib/tenant';
import { ProgressView, type Doubts, type Practice, type Progress } from '../progress-view';

export default async function MyProgress() {
  const { institute, member, db } = await requireMember(['student']);
  const args = { inst: institute.id, student: member.userId };
  const [{ data, error }, { data: doubts, error: doubtsError }, { data: practice, error: practiceError }] =
    await Promise.all([
      db.rpc('student_progress', args),
      db.rpc('tutor_activity', args),
      db.rpc('practice_activity', args),
    ]);
  if (error || doubtsError || practiceError) throw error ?? doubtsError ?? practiceError;
  return (
    <>
      <div className="top">
        <h1>My progress</h1>
      </div>
      <ProgressView p={data as Progress} staff={false} doubts={doubts as Doubts} practice={practice as Practice} />
    </>
  );
}
