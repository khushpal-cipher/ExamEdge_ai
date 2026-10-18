import { formatTime } from '@/lib/assess';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../flash';
import { sendReview } from './actions';

// Students write reviews of the coaching; only owner/admin read them, teachers get 404 (ADR-047).
export default async function Reviews({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember([...MANAGERS, 'student']);
  if (member.role === 'student')
    return (
      <>
        <div className="top">
          <div>
            <h1>Review</h1>
            <p className="muted">Tell {institute.name} what you like and what should be better.</p>
          </div>
        </div>
        <Flash searchParams={searchParams} />
        <form action={sendReview} className="card stack">
          <label>
            Your review
            <textarea name="body" rows={6} maxLength={2000} required />
          </label>
          <label className="row" style={{ display: 'flex' }}>
            <input type="checkbox" name="anonymous" /> Hide my name
          </label>
          <p className="muted small">
            Only the owner and admins of {institute.name} read reviews, not your teachers. If you hide your name, your
            name is not saved with the review, so nobody can see who wrote it.
          </p>
          <button type="submit" className="primary">
            Send review
          </button>
        </form>
      </>
    );

  const [{ data: reviews, error }, { data: profiles }] = await Promise.all([
    db
      .from('reviews')
      .select('id, body, user_id, created_at, batches(name)')
      .eq('institute_id', institute.id)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('profiles').select('user_id, full_name'),
  ]);
  if (error) throw error;
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  return (
    <>
      <div className="top">
        <div>
          <h1>Reviews</h1>
          <p className="muted">What students say about {institute.name}. Only owners and admins see this page.</p>
        </div>
      </div>
      {reviews.length === 0 && <p className="empty">No reviews yet.</p>}
      {reviews.map((r) => (
        <article key={r.id} className="card stack" aria-label={`Review from ${formatTime(r.created_at)}`}>
          <p className="muted small">
            <b>{r.user_id ? (name.get(r.user_id) ?? 'Unnamed') : 'Anonymous'}</b> ·{' '}
            {(r.batches as unknown as { name: string }).name} · {formatTime(r.created_at)}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
        </article>
      ))}
    </>
  );
}
