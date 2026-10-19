import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid, MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { addBatchMember, createSubject, moveStudents, removeBatchMember, setBatchArchived } from '../../actions';
import { Flash } from '../../flash';
import { Standings } from './standings';

type Row = {
  membership_id: string;
  batch_role: string;
  left_at: string | null;
  memberships: { user_id: string; status: string } | null;
};

export default async function Batch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; sort?: string }>;
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
  const [{ data: subjects }, { data: others }, { data: rows }, { data: profiles }, { data: members }] =
    await Promise.all([
      db.from('subjects').select('id, name').eq('institute_id', institute.id).eq('batch_id', id).order('name'),
      manager
        ? db
            .from('batches')
            .select('id, name, academic_year')
            .eq('institute_id', institute.id)
            .neq('id', id)
            .is('archived_at', null)
            .order('name')
        : Promise.resolve({ data: [] as { id: string; name: string; academic_year: string | null }[] }),
      db
        .from('batch_members')
        .select('membership_id, batch_role, left_at, memberships(user_id, status)')
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
  const sorted = (role: string) =>
    inBatch
      .filter((r) => r.batch_role === role)
      .sort((a, b) => Number(!!a.left_at) - Number(!!b.left_at))
      .map((r) => ({ ...r, name: name.get(r.memberships?.user_id ?? '') ?? 'Unnamed' }))
      .sort((a, b) => Number(!!a.left_at) - Number(!!b.left_at) || a.name.localeCompare(b.name));
  const current = sorted('student').filter((r) => !r.left_at);
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
        <h2 id="subjects">Subjects</h2>
        {!subjects?.length ? (
          <p className="empty">No subjects in this batch yet.</p>
        ) : (
          <ul className="pills">
            {subjects.map((s) => (
              <li key={s.id}>
                <Link href={`/subjects/${s.id}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        )}
        {manager && (
          <form action={createSubject} className="inline">
            <input type="hidden" name="batch_id" value={batch.id} />
            <label>
              New subject
              <input name="name" required maxLength={120} placeholder="Maths" />
            </label>
            <button type="submit">Add subject</button>
          </form>
        )}
      </section>

      <Standings ctx={{ institute, member, db }} batch={batch.id} sort={(await searchParams).sort} />

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
                          {r.left_at && <span className="badge">Moved on</span>}
                          {r.memberships?.status !== 'active' && (
                            <span className="badge warn">{r.memberships?.status}</span>
                          )}
                        </td>
                        {manager && (
                          <td style={{ textAlign: 'right' }}>
                            <form action={removeBatchMember}>
                              <input type="hidden" name="batch_id" value={batch.id} />
                              <input type="hidden" name="membership_id" value={r.membership_id} />
                              <button type="submit" className="link danger" aria-label={`Remove ${r.name} from batch`}>
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

      {manager && current.length > 0 && (others ?? []).length > 0 && (
        <section className="card stack" aria-labelledby="move">
          <h2 id="move">Move students to another batch</h2>
          <p className="small muted">
            For promotion, e.g. Class 9 → Class 10. They stay in this batch&apos;s history and can still read its notes
            and results, but cannot take its new tests.
          </p>
          <form action={moveStudents} className="stack">
            <input type="hidden" name="batch_id" value={batch.id} />
            <fieldset className="stack">
              <legend>Students</legend>
              {current.map((r) => (
                <label key={r.membership_id} className="row">
                  <input type="checkbox" name="membership_id" value={r.membership_id} defaultChecked />
                  {r.name}
                </label>
              ))}
            </fieldset>
            <div className="inline">
              <label>
                New batch
                <select name="to_batch_id" required>
                  {others!.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.academic_year && `(${b.academic_year})`}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary">
                Move students
              </button>
            </div>
          </form>
        </section>
      )}

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
