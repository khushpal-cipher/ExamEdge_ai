import { notFound } from 'next/navigation';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { ProgressView, type Doubts, type Practice, type Progress } from '../../progress-view';

// A student's full progress (HOW_IT_WORKS 2E). The id is the student's user id; the database allows owner/admin and
// the student's own teachers only, and returns exactly what the student sees on "My progress" (AC7.9).
export default async function StudentProgress({ params }: { params: Promise<{ id: string }> }) {
  const { institute, db } = await requireMember(STAFF);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data, error }, { data: doubts }, { data: practice }, { data: profile }] = await Promise.all([
    db.rpc('student_progress', { inst: institute.id, student: id }),
    db.rpc('tutor_activity', { inst: institute.id, student: id }),
    db.rpc('practice_activity', { inst: institute.id, student: id }),
    db.from('profiles').select('full_name').eq('user_id', id).maybeSingle(),
  ]);
  if (error) notFound();
  return (
    <>
      <div className="top">
        <div>
          <p className="small muted">Student progress</p>
          <h1>{profile?.full_name ?? 'Student'}</h1>
        </div>
      </div>
      <ProgressView
        p={data as Progress}
        staff
        doubts={(doubts ?? []) as Doubts}
        practice={(practice ?? []) as Practice}
      />
    </>
  );
}
