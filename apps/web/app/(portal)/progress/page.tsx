import { studentBatches } from '@/lib/student';
import { requireMember } from '@/lib/tenant';
import { ProgressView, type Doubts, type Practice, type Progress } from '../progress-view';

export default async function MyProgress() {
  const { institute, member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  // The selected batch only (ADR-040); a student in no batch has nothing to show anyway.
  const args = { inst: institute.id, student: member.userId, batch: selected?.id };
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
        <div>
          <h1>My progress</h1>
          {selected && <p className="muted">{selected.name}</p>}
        </div>
      </div>
      <ProgressView p={data as Progress} staff={false} doubts={doubts as Doubts} practice={practice as Practice} />
    </>
  );
}

export const metadata = { title: 'My progress' };
