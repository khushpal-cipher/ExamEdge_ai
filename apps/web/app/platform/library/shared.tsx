import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// getClaims verifies the JWT; the database re-checks aal2 in every policy anyway.
export async function adminPage() {
  const db = await supabase();
  const { data: claims } = await db.auth.getClaims();
  if (claims?.claims.aal !== 'aal2') redirect('/');
  return db;
}

const OK: Record<string, string> = {
  saved: 'Saved.',
  reviewed: 'Marked as reviewed by you.',
  draft: 'Back to draft.',
  published: 'Published. Students of institutes that map this subject can read it, and the tutor can cite it.',
  retired: 'Retired. Students no longer see it.',
};
const ERRORS: Record<string, string> = {
  invalid: 'Please check the values and try again.',
  duplicate: 'That name is already used here.',
  not_reviewed: 'Mark the item as reviewed before publishing it.',
  ai: 'AI is switched off, so the item could not be prepared for the tutor. Turn AI back on and retry.',
  failed: 'Something went wrong. Please try again.',
};

export async function LibraryFlash({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  if (error)
    return (
      <p role="alert" className="alert">
        {ERRORS[error] ?? ERRORS.failed}
      </p>
    );
  if (ok && OK[ok])
    return (
      <p role="status" className="notice">
        {OK[ok]}
      </p>
    );
  return null;
}

export const STATUS_TONE: Record<string, string> = { draft: '', reviewed: 'warn', published: 'good', retired: 'bad' };
