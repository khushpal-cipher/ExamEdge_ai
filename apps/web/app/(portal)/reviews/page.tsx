import { formatTime } from '@/lib/assess';
import { MANAGERS, requireMember } from '@/lib/tenant';
import { Flash, type Search } from '../flash';
import { replyReview, sendReview } from './actions';

// Students write reviews of the coaching; only owner/admin read them, teachers get 404 (ADR-047).
export default async function Reviews({ searchParams }: { searchParams: Search }) {
  const { institute, member, db } = await requireMember([...MANAGERS, 'student']);
  if (member.role === 'student') {
    // Own reviews, anonymous ones too (the author link is private; the institute never sees it).
    const { data, error } = await db.rpc('my_reviews', { inst: institute.id });
    if (error) throw error;
    const mine = (data ?? []) as {
      id: string;
      body: string;
      anonymous: boolean;
      created_at: string;
      reply: string | null;
    }[];
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
            <textarea name="body" rows={4} maxLength={2000} required />
          </label>
          <label className="row" style={{ display: 'flex' }}>
            <input type="checkbox" name="anonymous" /> Hide my name
          </label>
          <p className="muted small">
            Only the owner and admins of {institute.name} read reviews, not your teachers. If you hide your name, your
            name is not shown to anyone at {institute.name}, and you still see their reply below.
          </p>
          <button type="submit" className="primary">
            Send review
          </button>
        </form>
        {mine.length > 0 && (
          <section className="stack" aria-labelledby="mine">
            <h2 id="mine">Your reviews</h2>
            {mine.map((r) => (
              <article key={r.id} className="card stack" aria-label={`Your review from ${formatTime(r.created_at)}`}>
                <p className="muted small">
                  {formatTime(r.created_at)}
                  {r.anonymous ? ' · name hidden' : ''}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
                {r.reply ? (
                  <p className="notice" style={{ whiteSpace: 'pre-wrap' }}>
                    <b>Reply from {institute.name}:</b> {r.reply}
                  </p>
                ) : (
                  <p className="muted small">No reply yet.</p>
                )}
              </article>
            ))}
          </section>
        )}
      </>
    );
  }

  const [{ data: reviews, error }, { data: profiles }] = await Promise.all([
    db
      .from('reviews')
      .select('id, body, user_id, created_at, reply, batches(name)')
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
      <Flash searchParams={searchParams} />
      {reviews.length === 0 && <p className="empty">No reviews yet.</p>}
      {reviews.map((r) => (
        <article key={r.id} className="card stack" aria-label={`Review from ${formatTime(r.created_at)}`}>
          <p className="muted small">
            <b>{r.user_id ? (name.get(r.user_id) ?? 'Unnamed') : 'Anonymous'}</b> ·{' '}
            {(r.batches as unknown as { name: string }).name} · {formatTime(r.created_at)}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
          <form action={replyReview} className="stack">
            <input type="hidden" name="review_id" value={r.id} />
            <label>
              Your reply
              <textarea name="reply" rows={2} maxLength={2000} defaultValue={r.reply ?? ''} />
            </label>
            <div>
              <button type="submit">{r.reply ? 'Update reply' : 'Reply'}</button>
            </div>
          </form>
        </article>
      ))}
    </>
  );
}

export const metadata = { title: 'Reviews' };
