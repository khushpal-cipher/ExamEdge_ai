const ERRORS: Record<string, string> = {
  denied: 'You are not allowed to do that.',
  duplicate: 'That name is already used.',
  invalid: 'Please check the values and try again.',
  plan_unclear:
    'The AI could not tell what to make. Name the topics, how many questions of each kind and the level, e.g. "10 MCQs + 5 theory on Networking and HTML, medium".',
  plan_too_many: 'That is too much for one request: at most 4 topic-and-type parts and 40 questions. Send it in parts.',
  plan_refused: 'The AI could not work on this request. Try writing it differently.',
  no_topics: 'This subject has no topics yet. Add topics (with published notes) first.',
  failed: 'Something went wrong. Please try again.',
  in_use: 'It is still used somewhere, so it cannot be deleted.',
  question_in_use:
    'This question is used in a scheduled test. Create a new question instead (the answer key can still be fixed).',
  test_has_no_questions: 'Add at least one question before scheduling.',
  test_has_no_batches: 'Choose at least one batch before scheduling.',
  test_question_not_ready: 'Every question must be approved and have a valid answer key before scheduling.',
  test_has_attempts: 'Students have already started this test, so it cannot go back to draft.',
  test_already_open: 'The test has opened; its times can no longer change.',
  test_not_closed: 'Results can be released only after the test closes.',
  unmarked_answers: 'Some written answers are not checked yet. Check them all before releasing results.',
  invalid_marks: 'Marks must be whole or half marks between 0 and the maximum.',
  invalid_key: 'The answer key does not match the options.',
  formula_broken: 'A formula in this question cannot be drawn (shown in red). Edit the question to fix it, then save.',
  question_not_verified:
    'The two AI answers to this question differ, or the second check did not run. Open it, fix it if needed and save it.',
  no_questions: 'The AI could not make usable questions from these notes. Try another topic or question type.',
  document_no_batches: 'Choose at least one batch.',
  document_not_ready: 'The file is still being processed. Publish it when it is ready.',
  closed: 'This test is not open right now.',
  time: 'Please enter valid times: the test must close after it opens.',
  quota: "You've used today's AI limit. It resets tomorrow.",
  budget: "Your institute's AI budget for this month is used up. Please tell your institute admin.",
  ai_disabled: 'AI is switched off right now. Please try again later.',
  no_sources: 'There are no published notes for this topic yet, so there is nothing to make it from.',
  coming_soon: 'Audio and video overviews are coming soon.',
  notes_refused: 'The AI could not write notes from this explanation. Try explaining it differently.',
  storage_full: 'Your institute’s storage is full. Ask your admin.',
  refused: 'The AI could not make this from these notes. Please ask your teacher.',
  generation_failed: 'The AI could not make this right now. Please try again.',
};
const OK: Record<string, string> = {
  saved: 'Saved.',
  deleted: 'Deleted.',
  revoked: 'Invitation revoked.',
  scheduled: 'Test scheduled. Students see it on their home page.',
  released: 'Results released. Ranks are updated.',
  cancelled: 'Test cancelled.',
  uploaded: 'Uploaded. It is published to the batch as soon as the file is read; this page updates by itself.',
  queued: 'Queued for processing.',
  published: 'Published. Students in the chosen batches can open it now.',
  withdrawn: 'Withdrawn. Students can no longer open it.',
  resolved: 'Marked as resolved.',
  generated: 'Ready. Made by AI for this topic.',
  reused: 'This was already made for this topic, so here it is (no AI use counted).',
  saved_draft: 'Saved. It is a draft again until you publish it.',
  questions_made: 'AI questions added below as drafts. Check each one and approve it before using it in a test.',
  approved: 'Approved. It can now be added to tests.',
  notes_written: 'AI notes written. Read and edit them below, then publish them when they are ready.',
  notes_saved: 'Saved as a new version. Students keep the current one until it is processed.',
  ai_questions_added:
    'AI questions added. Open each one to check it (MCQs whose answers match can be approved here), then schedule the test.',
  ai_questions_partial:
    'AI questions added, but some could not be made (a topic without published notes, or the AI found nothing usable). Check them, then schedule the test.',
  ai_questions_formula:
    'AI questions added. Some have a formula that cannot be drawn: they are marked "formula broken". Fix those, check the rest, then schedule the test.',
  question_added: 'Question added to the test and saved in the question bank.',
  reply_saved: 'Reply saved.',
  review_sent: 'Thank you. Your review was sent to the owner and admins.',
  moved: 'Moved. The old batch stays in their history (read-only).',
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
      // Short confirmations float and fade away; longer ones stay because they say what to do next.
      <p role="status" className={OK[ok].length <= 60 ? 'notice toast' : 'notice'}>
        {OK[ok]}
      </p>
    );
  return null;
}

export type Search = Promise<{ ok?: string; error?: string; tab?: string }>;
