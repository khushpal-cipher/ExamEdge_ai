'use server';

// Tutor Server Functions. RLS decides: only the owner of a chat can rate or report its answers, and only staff of the
// institute can resolve a report. The institute always comes from the host (requireMember).
import { done } from '../../form';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';

export async function rateAnswer(messageId: string, feedback: 'up' | 'down' | null) {
  const { institute, db } = await requireMember();
  if (!isUuid(messageId) || !['up', 'down', null].includes(feedback)) return false;
  const { error } = await db
    .from('messages')
    .update({ feedback })
    .eq('institute_id', institute.id)
    .eq('id', messageId)
    .eq('role', 'assistant');
  return !error;
}

export async function reportAnswer(messageId: string, reason: string) {
  const { db } = await requireMember();
  if (!isUuid(messageId)) return false;
  const { error } = await db.rpc('report_answer', { msg: messageId, why: reason.trim().slice(0, 500) || null });
  return !error;
}

export async function resolveReport(form: FormData) {
  const { institute, member, db } = await requireMember(STAFF);
  const id = form.get('report_id');
  const subject = form.get('subject_id');
  if (!isUuid(id) || !isUuid(subject)) done('/subjects', { code: '23514' });
  const { error } = await db
    .from('answer_reports')
    .update({ resolved_at: new Date().toISOString(), resolved_by: member.userId })
    .eq('institute_id', institute.id)
    .eq('id', id);
  done(`/subjects/${subject}`, error, 'resolved');
}
