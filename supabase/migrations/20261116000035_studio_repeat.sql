-- ADR-054 (founder): a student may make the same study tool again (a new quiz, new flashcards, …) until their AI
-- limit stops them, like NotebookLM. Only the per-student "one per input" rule goes; one institute artifact per input
-- stays (AC9.2 for staff).
drop index public.generated_artifacts_student_input;
