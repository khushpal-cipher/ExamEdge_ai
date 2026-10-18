'use server';

// Student review of the coaching (ADR-047). RLS decides: only a student, only about a batch they are in, and only
// under their own id or none ("Hide my name" stores no id at all).
import { done, text } from '../form';
import { studentBatches } from '@/lib/student';
import { requireMember } from '@/lib/tenant';

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
