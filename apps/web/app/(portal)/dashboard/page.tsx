import Link from 'next/link';
import { MANAGERS, requireMember, STAFF } from '@/lib/tenant';

export default async function Dashboard() {
  const { institute, member, db } = await requireMember(STAFF);
  const manager = MANAGERS.includes(member.role);
  const [students, batches, mine, invites] = await Promise.all([
    db
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('institute_id', institute.id)
      .eq('role', 'student')
      .eq('status', 'active'),
    db
      .from('batches')
      .select('id, name, academic_year, batch_members(count)')
      .eq('institute_id', institute.id)
      .eq('batch_members.batch_role', 'student')
      .is('archived_at', null)
      .order('name'),
    db.from('batch_members').select('batch_id').eq('institute_id', institute.id).eq('membership_id', member.id),
    manager
      ? db
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('institute_id', institute.id)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
      : Promise.resolve({ count: null }),
  ]);
  const myBatches = new Set((mine.data ?? []).map((r) => r.batch_id));
  const shown = (batches.data ?? []).filter((b) => manager || myBatches.has(b.id));

  return (
    <>
      <div className="top">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{manager ? 'Everything in your institute.' : 'Your batches and students.'}</p>
        </div>
        <div className="row">
          <Link className="button" href="/subjects">
            Subjects
          </Link>
          <Link className="button primary" href="/people?tab=invitations">
            Invite people
          </Link>
        </div>
      </div>
      <div className="grid">
        <div className="card stat">
          <span className="muted small">{manager ? 'Students' : 'Students in your batches'}</span>
          <b>{students.count ?? 0}</b>
        </div>
        <div className="card stat">
          <span className="muted small">{manager ? 'Active batches' : 'Your batches'}</span>
          <b>{shown.length}</b>
        </div>
        {manager && (
          <div className="card stat">
            <span className="muted small">Pending invitations</span>
            <b>{invites.count ?? 0}</b>
          </div>
        )}
      </div>
      <section className="card stack" aria-labelledby="batches">
        <h2 id="batches">{manager ? 'Batches' : 'Your batches'}</h2>
        {shown.length === 0 ? (
          <p className="empty">
            {manager ? 'No batches yet. Create one on the Batches page.' : 'You are not assigned to a batch yet.'}
          </p>
        ) : (
          <div className="grid">
            {shown.map((b) => (
              <Link key={b.id} href={`/batches/${b.id}`} className="card tile">
                <h3>{b.name}</h3>
                <p className="muted small">
                  {b.academic_year || 'No year'} · {(b.batch_members as unknown as { count: number }[])[0]?.count ?? 0}{' '}
                  students
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="card stack" aria-labelledby="next">
        <h2 id="next">Where things are</h2>
        <p className="empty">
          Notes, AI notes and AI tests are inside each subject&apos;s topics. Tests, checking and rank lists are under
          Tests.
        </p>
      </section>
    </>
  );
}

export const metadata = { title: 'Dashboard' };
