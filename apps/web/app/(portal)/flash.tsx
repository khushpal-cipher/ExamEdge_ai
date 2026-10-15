const ERRORS: Record<string, string> = {
  denied: 'You are not allowed to do that.',
  duplicate: 'That name is already used.',
  invalid: 'Please check the values and try again.',
  failed: 'Something went wrong. Please try again.',
};
const OK: Record<string, string> = { saved: 'Saved.', deleted: 'Deleted.', revoked: 'Invitation revoked.' };

export async function Flash({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  if (error && ERRORS[error])
    return (
      <p role="alert" className="alert">
        {ERRORS[error]}
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

export type Search = Promise<{ ok?: string; error?: string; tab?: string }>;
