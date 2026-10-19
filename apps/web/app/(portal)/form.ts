// Form helpers shared by the portal Server Functions (not a 'use server' module: nothing here is callable from the browser).
import { redirect } from 'next/navigation';
import { log } from '@examedge/core/log';

export const text = (form: FormData, key: string, max = 120) =>
  String(form.get(key) ?? '')
    .trim()
    .slice(0, max);

// Database exceptions raised by name in the migrations; each has a message in flash.tsx.
const NAMED = [
  'question_in_use',
  'question_not_verified',
  'test_has_no_questions',
  'test_has_no_batches',
  'test_question_not_ready',
  'test_has_attempts',
  'test_already_open',
  'test_not_closed',
  'unmarked_answers',
  'invalid_marks',
  'invalid_key',
  'document_no_batches',
  'document_not_ready',
  'formula_broken',
];

export function done(path: string, error?: { code?: string; message?: string } | null, okCode = 'saved'): never {
  if (error) {
    // 42501 = RLS/guard denied, 23505 = duplicate name, 23514 = check failed, 23503 = still referenced.
    const code = NAMED.includes(error.message ?? '')
      ? error.message!
      : ({ '42501': 'denied', '23505': 'duplicate', '23514': 'invalid', '23503': 'in_use' }[error.code ?? ''] ??
        'failed');
    if (code === 'failed') log.error('staff.action_failed', { path, code: error.code });
    redirect(`${path}${path.includes('?') ? '&' : '?'}error=${code}`);
  }
  redirect(`${path}${path.includes('?') ? '&' : '?'}ok=${okCode}`);
}
