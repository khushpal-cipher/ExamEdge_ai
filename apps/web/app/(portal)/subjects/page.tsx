import Link from 'next/link';
import { MANAGERS, requireMember, STAFF } from '@/lib/tenant';
import { Flash, type Search } from '../flash';

type Batch = {
  id: string;
  name: string;
  academic_year: string | null;
  subjects: { id: string; name: string; chapters: { count: number }[] }[];
};

// Subjects live inside batches (ADR-038); owners add them on the batch page. Teachers see only the batches they
// teach (a UI filter: RLS still lets staff read every subject).
export default async function Subjects({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const manager = MANAGERS.includes(member.role);
  const [{ data }, { data: mine }] = await Promise.all([
    db
      .from('batches')
      .select('id, name, academic_year, subjects(id, name, chapters(count))')
      .eq('institute_id', institute.id)
      .is('archived_at', null)
      .order('name'),
    db.from('batch_members').select('batch_id').eq('institute_id', institute.id).eq('membership_id', member.id),
  ]);
  const teaching = new Set((mine ?? []).map((r) => r.batch_id));
  const batches = ((data ?? []) as unknown as Batch[]).filter((b) => manager || teaching.has(b.id));
  return (
    <>
      <div className="top">
        <div>
          <h1>Subjects</h1>
          <p className="muted">
            {manager
              ? 'Each batch has its own subjects. Add them on the batch page.'
              : 'Subjects of the batches you teach.'}
          </p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {!batches.length && <p className="empty">No batches yet.</p>}
      {batches.map((b) => (
        <section key={b.id} className="card stack" aria-labelledby={`b-${b.id}`}>
          <div className="top">
            <h2 id={`b-${b.id}`}>
              {b.name} {b.academic_year && <span className="muted small">{b.academic_year}</span>}
            </h2>
            {manager && <Link href={`/batches/${b.id}`}>Add subjects</Link>}
          </div>
          {b.subjects.length === 0 ? (
            <p className="empty">No subjects yet.</p>
          ) : (
            <ul className="pills" aria-label={`Subjects of ${b.name}`}>
              {[...b.subjects]
                .sort((x, y) => x.name.localeCompare(y.name))
                .map((s) => (
                  <li key={s.id}>
                    <Link href={`/subjects/${s.id}`}>{s.name}</Link>{' '}
                    <span className="small muted">
                      {s.chapters[0]?.count ?? 0} topic{s.chapters[0]?.count === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
