'use server';

// Student review of the coaching (ADR-047). RLS decides: only a student, only about a batch they are in, and only
// under their own id or none ("Hide my name" stores no id at all).
import { done, text } from '../form';
import { studentBatches } from '@/lib/student';
import { isUuid, MANAGERS, requireMember } from '@/lib/tenant';

export async function sendReview(form: FormData) {
  const { institute, member, db } = await requireMember(['student']);
  const batch = (await studentBatches()).selected;
  const body = text(form, 'body', 2000);
  if (!batch || !body) done('/reviews', { code: '23514' });
  const { error } = await db.from('reviews').insert({
    institute_id: institute.id,
    batch_id: batch.id,
    user_id: form.get('anonymous') ? null : member.userId,
    body,
  });
  done('/reviews', error, 'review_sent');
}

// Owner/admin reply (an empty reply removes it). The database stamps who and when.
export async function replyReview(form: FormData) {
  const { institute, db } = await requireMember(MANAGERS);
  const id = form.get('review_id');
  if (!isUuid(id)) done('/reviews', { code: '23514' });
  const { error } = await db
    .from('reviews')
    .update({ reply: text(form, 'reply', 2000) || null })
    .eq('institute_id', institute.id)
    .eq('id', id);
  done('/reviews', error, 'reply_saved');
}
