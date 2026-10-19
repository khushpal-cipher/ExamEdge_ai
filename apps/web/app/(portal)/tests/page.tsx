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
  const { data: subjects } = await db
    .from('subjects')
    .select('id, name, batch_id')
    .eq('institute_id', institute.id)
    .in(
      'batch_id',
      batches.map((b) => b.id),
    )
    .order('name');
  return (
    <>
      <div className="top">
        <div>
          <h1>Tests</h1>
          <p className="muted">Pick the subject, then fill the test with AI or by typing questions, and schedule it.</p>
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
          <label>
            Subject (and its batch)
            <select name="subject_id" required defaultValue="">
              <option value="" disabled>
                {batches.length ? 'Pick a subject' : 'You do not teach any batch yet'}
              </option>
              {batches.map((b) => (
                <optgroup key={b.id} label={b.name}>
                  {(subjects ?? [])
                    .filter((s) => s.batch_id === b.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {b.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="row" style={{ display: 'flex' }}>
            <input type="checkbox" name="shuffle" /> Shuffle question order for each student
          </label>
          <label className="row" style={{ display: 'flex' }}>
            <input type="checkbox" name="cbt" /> CBT mode: the test runs in full screen; leaving it or switching tab or
            app is a warning, and the 3rd warning submits the test (students must use Google Chrome)
          </label>
          <div className="row">
            <button type="submit" className="primary">
              Create test
            </button>
            <span className="small muted">Next page: add questions with AI or type them.</span>
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
                  <th className="num">Duration</th>
                  <th className="num">Questions</th>
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
                      <td className="num">{formatDuration(t.duration_seconds)}</td>
                      <td className="num">{(t.test_questions as unknown as { count: number }[])[0]?.count ?? 0}</td>
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
