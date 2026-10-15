const ERRORS: Record<string, string> = {
  denied: 'You are not allowed to do that.',
  duplicate: 'That name is already used.',
  invalid: 'Please check the values and try again.',
  failed: 'Something went wrong. Please try again.',
  in_use: 'It is still used somewhere, so it cannot be deleted.',
  question_in_use:
    'This question is used in a scheduled test. Create a new question instead (the answer key can still be fixed).',
  test_has_no_questions: 'Add at least one question before scheduling.',
  test_has_no_batches: 'Choose at least one batch before scheduling.',
  test_question_not_ready: 'Every question needs a valid answer key before scheduling.',
  test_has_attempts: 'Students have already started this test, so it cannot go back to draft.',
  test_already_open: 'The test has opened; its times can no longer change.',
  test_not_closed: 'Results can be released only after the test closes.',
  unmarked_answers: 'Some written answers are not checked yet. Check them all before releasing results.',
  invalid_marks: 'Marks must be whole or half marks between 0 and the maximum.',
  invalid_key: 'The answer key does not match the options.',
  closed: 'This test is not open right now.',
  time: 'Please enter valid times: the test must close after it opens.',
};
const OK: Record<string, string> = {
  saved: 'Saved.',
  deleted: 'Deleted.',
  revoked: 'Invitation revoked.',
  scheduled: 'Test scheduled. Students see it on their home page.',
  released: 'Results released. Ranks are updated.',
  cancelled: 'Test cancelled.',
};

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
