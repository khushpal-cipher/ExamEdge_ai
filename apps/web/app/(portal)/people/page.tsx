import Link from 'next/link';
import { MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { revokeInvitation, updateMembership } from '../actions';
import { Flash, type Search } from '../flash';
import { InviteForm } from './invite-form';

type Membership = { id: string; user_id: string; role: string; status: string; batch_members: { batch_id: string }[] };
const TABS = [
  ['staff', 'Staff'],
  ['students', 'Students'],
  ['invitations', 'Invitations'],
];

export default async function People({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const manager = MANAGERS.includes(member.role);
  const requested = (await searchParams).tab;
  const tab = TABS.some(([t]) => t === requested) ? requested! : 'staff';
  const [{ data: memberships }, { data: profiles }, { data: batches }, { data: invites }] = await Promise.all([
    db
      .from('memberships')
      .select('id, user_id, role, status, batch_members(batch_id)')
      .eq('institute_id', institute.id)
      .neq('status', 'removed'),
    db.from('profiles').select('user_id, full_name'),
    db.from('batches').select('id, name').eq('institute_id', institute.id).is('archived_at', null).order('name'),
    db
      .from('invitations')
      .select('id, email, role, batch_id, expires_at, created_at')
      .eq('institute_id', institute.id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  const batchName = new Map((batches ?? []).map((b) => [b.id, b.name]));
  const people = ((memberships ?? []) as Membership[])
    .map((m) => ({ ...m, name: name.get(m.user_id) ?? 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const list = people.filter((p) => (tab === 'students' ? p.role === 'student' : p.role !== 'student'));
  // Teachers may invite students into batches they teach; owners invite admins (DB enforces the same rules).
  const roles =
    member.role === 'owner' ? ['student', 'teacher', 'admin', 'owner'] : manager ? ['student', 'teacher'] : ['student'];
  const mine = new Set(people.find((p) => p.id === member.id)?.batch_members.map((b) => b.batch_id));
  const inviteBatches = (batches ?? []).filter((b) => manager || mine.has(b.id));

  return (
    <>
      <div className="top">
        <h1>People</h1>
      </div>
      <nav aria-label="People sections" className="row">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/people?tab=${t}`}
            className={`button${t === tab ? ' primary' : ''}`}
            aria-current={t === tab ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Flash searchParams={searchParams} />

      {tab === 'invitations' ? (
        <>
          <section className="card stack" aria-labelledby="invite">
            <h2 id="invite">Invite people</h2>
            <InviteForm roles={roles} batches={inviteBatches} />
          </section>
          <section className="card stack" aria-labelledby="pending">
            <h2 id="pending">Pending invitations ({invites?.length ?? 0})</h2>
            {!invites?.length ? (
              <p className="empty">No pending invitations.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Batch</th>
                      <th>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((i) => (
                      <tr key={i.id}>
                        <td>{i.email}</td>
                        <td>{i.role}</td>
                        <td>{i.batch_id ? (batchName.get(i.batch_id) ?? '—') : '—'}</td>
                        <td>
                          {new Date(i.expires_at) < new Date() ? (
                            <span className="badge bad">Expired</span>
                          ) : (
                            new Date(i.expires_at).toLocaleDateString('en-IN')
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <form action={revokeInvitation}>
                            <input type="hidden" name="invitation_id" value={i.id} />
                            <button type="submit" className="link" aria-label={`Revoke invitation for ${i.email}`}>
                              Revoke
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="card stack" aria-labelledby="list">
          <h2 id="list">
            {tab === 'students' ? 'Students' : 'Staff'} ({list.length})
          </h2>
          {list.length === 0 ? (
            <p className="empty">Nobody here yet. Invite people from the Invitations tab.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Batches</th>
                    <th>Role and status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>{p.role === 'student' ? <Link href={`/students/${p.user_id}`}>{p.name}</Link> : p.name}</td>
                      <td className="small">
                        {p.batch_members
                          .map((b) => batchName.get(b.batch_id))
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td>
                        {manager && p.id !== member.id ? (
                          <form action={updateMembership} className="row">
                            <input type="hidden" name="membership_id" value={p.id} />
                            <label className="sr-only" htmlFor={`r-${p.id}`}>
                              Role of {p.name}
                            </label>
                            {p.role === 'student' ? (
                              <input type="hidden" name="role" value="student" />
                            ) : (
                              <select id={`r-${p.id}`} name="role" defaultValue={p.role}>
                                {['teacher', 'admin', 'owner'].map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </select>
                            )}
                            <label className="sr-only" htmlFor={`st-${p.id}`}>
                              Status of {p.name}
                            </label>
                            <select id={`st-${p.id}`} name="status" defaultValue={p.status}>
                              <option value="active">active</option>
                              <option value="suspended">suspended</option>
                              <option value="removed">removed</option>
                            </select>
                            <button type="submit">Save</button>
                          </form>
                        ) : (
                          <span>
                            {p.role} {p.status !== 'active' && <span className="badge warn">{p.status}</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
