import Link from 'next/link';
import { requireMember } from '@/lib/tenant';

export default async function StudentHome() {
  const { institute, member, db } = await requireMember(['student']);
  // RLS returns only the student's own batches and the subjects/chapters of those batches (AC3.4).
  const [{ data: me }, { data: batches }, { data: subjects }] = await Promise.all([
    db.from('profiles').select('full_name').eq('user_id', member.userId).maybeSingle(),
    db.from('batches').select('name').eq('institute_id', institute.id).is('archived_at', null).order('name'),
    db.from('subjects').select('id, name, chapters(count)').eq('institute_id', institute.id).order('name'),
  ]);
  const first = me?.full_name?.split(' ')[0];
  return (
    <>
      <div className="top">
        <div>
          <h1>{first ? `Hello, ${first}` : 'Hello'}</h1>
          <p className="muted">{(batches ?? []).map((b) => b.name).join(' · ') || 'You are not in a batch yet.'}</p>
        </div>
      </div>
      <section className="card stack" aria-labelledby="my-subjects">
        <h2 id="my-subjects">My subjects</h2>
        {!subjects?.length ? (
          <p className="empty">No subjects yet. Your institute adds them to your batch.</p>
        ) : (
          <div className="grid">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card tile">
                <h3>{s.name}</h3>
                <p className="muted small">{(s.chapters as unknown as { count: number }[])[0]?.count ?? 0} chapters</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="grid">
        <section className="card stack" aria-labelledby="upcoming">
          <h2 id="upcoming">Upcoming tests</h2>
          <p className="empty">No tests scheduled yet.</p>
        </section>
        <section className="card stack" aria-labelledby="progress">
          <h2 id="progress">My progress</h2>
          <p className="empty">Your ranks and marks appear here after your first released test.</p>
        </section>
      </div>
    </>
  );
}
