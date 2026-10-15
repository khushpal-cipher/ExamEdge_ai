import Link from 'next/link';
import { formatDuration, formatTime, PHASE_LABEL, testPhase } from '@/lib/assess';
import { requireMember, STAFF } from '@/lib/tenant';
import { Flash, type Search } from '../flash';
import { createTest } from './actions';
import { teachableBatches } from './batches';

const BADGE: Record<string, string> = { open: 'good', closed: 'warn', released: 'good', cancelled: 'bad' };

export default async function Tests({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember(STAFF);
  const [{ data: tests }, batches] = await Promise.all([
    db
      .from('tests')
      .select(
        'id, title, status, opens_at, closes_at, duration_seconds, test_audience(batches(name)), test_questions(count)',
      )
      .eq('institute_id', institute.id)
      .order('opens_at', { ascending: false }),
    teachableBatches(db, institute.id, member),
  ]);
  return (
    <>
      <div className="top">
        <div>
          <h1>Tests</h1>
          <p className="muted">Create a test, add questions from the bank, then schedule it for your batches.</p>
        </div>
        <Link href="/questions" className="button">
          Question bank
        </Link>
      </div>
      <Flash searchParams={searchParams} />
      <section className="card stack" aria-labelledby="new-test">
        <h2 id="new-test">New test</h2>
        <form action={createTest} className="stack">
          <div className="inline">
            <label>
              Title
              <input name="title" required maxLength={200} placeholder="Physics Test 3" />
            </label>
            <label>
              Opens (India time)
              <input name="opens_at" type="datetime-local" required />
            </label>
            <label>
              Closes (India time)
              <input name="closes_at" type="datetime-local" required />
            </label>
            <label>
              Duration (minutes)
              <input name="duration_minutes" type="number" min={1} max={1440} defaultValue={60} required />
            </label>
          </div>
          <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted">Batches taking the test</legend>
            {batches.length === 0 && <span className="muted small">You do not teach any batch yet.</span>}
            {batches.map((b) => (
              <label key={b.id} className="row" style={{ display: 'flex' }}>
                <input type="checkbox" name="batch_id" value={b.id} />
                {b.name}
              </label>
            ))}
          </fieldset>
          <label className="row" style={{ display: 'flex' }}>
            <input type="checkbox" name="shuffle" /> Shuffle question order for each student
          </label>
          <div>
            <button type="submit" className="primary">
              Create test
            </button>
          </div>
        </form>
      </section>
      <section className="card" aria-labelledby="all-tests">
        <h2 id="all-tests">All tests</h2>
        {!tests?.length ? (
          <p className="empty">No tests yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Batches</th>
                  <th>Opens</th>
                  <th>Duration</th>
                  <th>Questions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const phase = testPhase(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/tests/${t.id}`}>{t.title}</Link>
                      </td>
                      <td>
                        {(t.test_audience as unknown as { batches: { name: string } | null }[])
                          .map((a) => a.batches?.name)
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td>{formatTime(t.opens_at)}</td>
                      <td>{formatDuration(t.duration_seconds)}</td>
                      <td>{(t.test_questions as unknown as { count: number }[])[0]?.count ?? 0}</td>
                      <td>
                        <span className={`badge ${BADGE[phase] ?? ''}`}>{PHASE_LABEL[phase]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
