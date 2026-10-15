import Link from 'next/link';
import { MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { createBatch } from '../actions';
import { Flash, type Search } from '../flash';

export default async function Batches({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const manager = MANAGERS.includes(member.role);
  const [{ data: all }, { data: exams }, { data: mine }] = await Promise.all([
    db
      .from('batches')
      .select('id, name, academic_year, archived_at, exams(name), batch_members(count)')
      .eq('institute_id', institute.id)
      .eq('batch_members.batch_role', 'student')
      .order('archived_at', { nullsFirst: true })
      .order('name'),
    db.from('exams').select('id, name').order('name'),
    db.from('batch_members').select('batch_id').eq('institute_id', institute.id).eq('membership_id', member.id),
  ]);
  const teaching = new Set((mine ?? []).map((r) => r.batch_id));
  const batches = (all ?? []).filter((b) => manager || teaching.has(b.id));
  return (
    <>
      <div className="top">
        <h1>Batches</h1>
      </div>
      <Flash searchParams={searchParams} />
      {manager && (
        <section className="card stack" aria-labelledby="new-batch">
          <h2 id="new-batch">New batch</h2>
          <form action={createBatch} className="inline">
            <label>
              Name
              <input name="name" required maxLength={120} placeholder="JEE 2027 Morning" />
            </label>
            <label>
              Academic year
              <input name="academic_year" maxLength={20} placeholder="2026-27" />
            </label>
            <label>
              Exam
              <select name="exam_id" defaultValue="">
                <option value="">None</option>
                {(exams ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary">
              Create batch
            </button>
          </form>
        </section>
      )}
      <section className="card" aria-labelledby="all-batches">
        <h2 id="all-batches">{manager ? 'All batches' : 'Batches you teach'}</h2>
        {!batches?.length ? (
          <p className="empty">No batches yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Year</th>
                  <th>Exam</th>
                  <th>Students</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/batches/${b.id}`}>{b.name}</Link>
                    </td>
                    <td>{b.academic_year || '—'}</td>
                    <td>{(b.exams as unknown as { name: string } | null)?.name ?? '—'}</td>
                    <td>{(b.batch_members as unknown as { count: number }[])[0]?.count ?? 0}</td>
                    <td>
                      {b.archived_at ? (
                        <span className="badge">Archived</span>
                      ) : (
                        <span className="badge good">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
