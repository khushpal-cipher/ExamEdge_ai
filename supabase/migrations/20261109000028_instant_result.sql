-- Founder (2026-10-18, ADR-046): a student sees their own result right after submitting, not only after release.
-- Before release: objective answers are marked live exactly as compute_results will (grade_objective, or a teacher's
-- override), an unanswered question is 0, written answers show the teacher's marks once checked (null = not checked yet). Correct answers and
-- explanations of objective questions appear only once the test's closing time passes, so an early finisher cannot
-- pass the key to classmates still writing; a written question's model answer stays hidden until release.
-- Ranks still come only with release. After release: unchanged.
create or replace function private.get_attempt_review(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, explanation text,
               response jsonb, key jsonb, marks numeric, marks_awarded numeric, teacher_comment text)
language plpgsql stable security definer set search_path = '' as $$
declare
  released boolean;
  closed boolean;
begin
  select t.status = 'results_released', now() >= t.closes_at into released, closed
  from public.test_attempts x join public.tests t on t.id = x.test_id
  where x.id = a and x.user_id = (select auth.uid()) and t.status <> 'cancelled'
    and (t.status = 'results_released' or x.status <> 'in_progress' or now() >= x.deadline_at);
  if not found then raise exception 'results_not_released' using errcode = '42501'; end if;
  return query
  select q.id, array_position(x.question_order, q.id), q.type, q.stem, q.options,
         case when released or (closed and q.type <> 'written') then q.explanation end,
         aa.response,
         case when released or (closed and q.type <> 'written') then k.key end,
         tq.marks,
         case when released or aa.attempt_id is null then coalesce(aa.marks_awarded, 0)
              when q.type = 'written' or aa.graded_by is not null then aa.marks_awarded
              else private.grade_objective(q.type, k.key, aa.response, tq.marks, tq.negative_marks) end,
         aa.teacher_comment
  from public.test_attempts x
  join public.test_questions tq on tq.test_id = x.test_id
  join public.questions q on q.id = tq.question_id
  join public.question_keys k on k.question_id = q.id
  left join public.attempt_answers aa on aa.attempt_id = x.id and aa.question_id = q.id
  where x.id = a
  order by 2;
end $$;
