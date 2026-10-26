import { studentBatches } from '@/lib/student';
import { requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../flash';
import { setOwnName } from '../actions';
import { ProgressView, type Doubts, type Practice, type Progress } from '../progress-view';

export default async function MyProgress({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(['student']);
  const { selected } = await studentBatches();
  // The selected batch only (ADR-040); a student in no batch has nothing to show anyway.
  const { data: me } = await db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle();
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
      <Flash searchParams={searchParams} />
      <details>
        <summary className="small">Change my name</summary>
        <form action={setOwnName} className="row">
          <label className="sr-only" htmlFor="own-name">
            My name
          </label>
          <input id="own-name" name="name" maxLength={120} required defaultValue={me?.full_name ?? ''} />
          <button type="submit">Save</button>
        </form>
      </details>
      <ProgressView p={data as Progress} staff={false} doubts={doubts as Doubts} practice={practice as Practice} />
    </>
  );
}

export const metadata = { title: 'My progress' };
