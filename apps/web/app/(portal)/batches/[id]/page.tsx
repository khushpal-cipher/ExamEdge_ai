import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { addBatchMember, removeBatchMember, setBatchArchived, setBatchSubjects } from '../../actions';
import { Flash, type Search } from '../../flash';

type Row = { membership_id: string; batch_role: string; memberships: { user_id: string; status: string } | null };

export default async function Batch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { institute, member, db } = await requireMember(STAFF);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: batch } = await db
    .from('batches')
    .select('id, name, academic_year, archived_at')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  if (!batch) notFound();
  const manager = MANAGERS.includes(member.role);
  const [{ data: subjects }, { data: chosen }, { data: rows }, { data: profiles }, { data: members }] =
    await Promise.all([
      db.from('subjects').select('id, name').eq('institute_id', institute.id).order('name'),
      db.from('batch_subjects').select('subject_id').eq('institute_id', institute.id).eq('batch_id', id),
      db
        .from('batch_members')
        .select('membership_id, batch_role, memberships(user_id, status)')
        .eq('institute_id', institute.id)
        .eq('batch_id', id),
      db.from('profiles').select('user_id, full_name'),
      manager
        ? db.from('memberships').select('id, user_id, role').eq('institute_id', institute.id).eq('status', 'active')
        : Promise.resolve({ data: [] as { id: string; user_id: string; role: string }[] }),
    ]);
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  const inBatch = (rows ?? []) as unknown as Row[];
  const inSet = new Set(inBatch.map((r) => r.membership_id));
  if (!manager && !inSet.has(member.id)) notFound(); // teachers open only batches they teach (TH-03)
  const chosenSet = new Set((chosen ?? []).map((c) => c.subject_id));
  const sorted = (role: string) =>
    inBatch
      .filter((r) => r.batch_role === role)
      .map((r) => ({ ...r, name: name.get(r.memberships?.user_id ?? '') ?? 'Unnamed' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  const addable = (members ?? [])
    .filter((m) => !inSet.has(m.id))
    .map((m) => ({ ...m, name: name.get(m.user_id) ?? 'Unnamed' }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href="/batches">Batches</Link>
          </p>
          <h1>{batch.name}</h1>
          <p className="muted">
            {batch.academic_year || 'No year'} {batch.archived_at && <span className="badge">Archived</span>}
          </p>
        </div>
        {manager && (
          <form action={setBatchArchived}>
            <input type="hidden" name="batch_id" value={batch.id} />
            <input type="hidden" name="archive" value={batch.archived_at ? '0' : '1'} />
            <button type="submit">{batch.archived_at ? 'Restore batch' : 'Archive batch'}</button>
          </form>
        )}
      </div>
      <Flash searchParams={searchParams} />

      <section className="card stack" aria-labelledby="subjects">
        <h2 id="subjects">Subjects studied</h2>
        {!subjects?.length ? (
          <p className="empty">
            No subjects yet. <Link href="/subjects">Add subjects</Link> first.
          </p>
        ) : manager ? (
          <form action={setBatchSubjects} className="stack">
            <input type="hidden" name="batch_id" value={batch.id} />
            <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">Subjects</legend>
              {subjects.map((s) => (
                <label key={s.id} className="row" style={{ display: 'flex' }}>
                  <input type="checkbox" name="subject_id" value={s.id} defaultChecked={chosenSet.has(s.id)} />
                  {s.name}
                </label>
              ))}
            </fieldset>
            <div>
              <button type="submit" className="primary">
                Save subjects
              </button>
            </div>
          </form>
        ) : (
          <ul className="pills">
            {subjects
              .filter((s) => chosenSet.has(s.id))
              .map((s) => (
                <li key={s.id}>
                  <Link href={`/subjects/${s.id}`}>{s.name}</Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      {(['teacher', 'student'] as const).map((role) => {
        const list = sorted(role);
        return (
          <section key={role} className="card stack" aria-labelledby={`${role}s`}>
            <h2 id={`${role}s`}>
              {role === 'teacher' ? 'Teachers' : 'Students'} ({list.length})
            </h2>
            {list.length === 0 ? (
              <p className="empty">No {role}s in this batch yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.membership_id}>
                        <td>{r.name}</td>
                        <td>
                          {r.memberships?.status !== 'active' && (
                            <span className="badge warn">{r.memberships?.status}</span>
                          )}
                        </td>
                        {manager && (
                          <td style={{ textAlign: 'right' }}>
                            <form action={removeBatchMember}>
                              <input type="hidden" name="batch_id" value={batch.id} />
                              <input type="hidden" name="membership_id" value={r.membership_id} />
                              <button type="submit" className="link" aria-label={`Remove ${r.name} from batch`}>
                                Remove
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {manager && addable.length > 0 && (
        <section className="card stack" aria-labelledby="add-member">
          <h2 id="add-member">Add someone to this batch</h2>
          <form action={addBatchMember} className="inline">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>
              Member
              <select name="membership_id" required>
                {addable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary">
              Add to batch
            </button>
          </form>
          <p className="small muted">New people join through invitations on the People page.</p>
        </section>
      )}
    </>
  );
}
