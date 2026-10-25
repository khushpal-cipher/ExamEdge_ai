-- Launch fixes from the 2026-10-25 code review (LAUNCH_PLAN "Code review findings").
-- 4: class size for the student Home ("#2 of N"): RLS shows a student only their own standings row, so count it here.
-- 6: report_answer accepts only an answer that came from a settled tutor call of the same student.
-- 8: multi-correct partial marks never exceed full marks (5+ correct options, 4 picked).
-- 11 ("Mix", changes ADR-046): after submitting a student sees the total at once; right/wrong per question only after
-- the test closes.

-- ---------------------------------------------------------------- 4
create function private.batch_standing_count(batch uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.in_batch(batch) or private.teaches_batch(batch)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (select count(*) from public.batch_standings where batch_id = batch);
end $$;
create function public.batch_standing_count(batch uuid) returns bigint
language sql stable security invoker set search_path = '' as $$ select private.batch_standing_count(batch) $$;
revoke execute on function private.batch_standing_count(uuid), public.batch_standing_count(uuid) from public;
grant execute on function private.batch_standing_count(uuid), public.batch_standing_count(uuid) to authenticated;

-- ---------------------------------------------------------------- 6
create unique index messages_usage_record_key on public.messages (usage_record_id) where usage_record_id is not null;

create or replace function private.report_answer(msg uuid, why text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.messages;
  c public.conversations;
  q text;
  rid uuid;
begin
  select * into m from public.messages where id = msg and role = 'assistant';
  select * into c from public.conversations where id = m.conversation_id;
  if m.id is null or c.user_id is distinct from (select auth.uid()) or private.member_id(c.institute_id) is null
     or not exists (select 1 from public.usage_records u
                    where u.id = m.usage_record_id and u.user_id = c.user_id and u.institute_id = c.institute_id
                      and u.feature in ('tutor', 'tutor_premium') and u.outcome = 'ok') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select content into q from public.messages
  where conversation_id = c.id and role = 'user' and created_at <= m.created_at
  order by created_at desc limit 1;
  insert into public.answer_reports (institute_id, subject_id, message_id, reported_by, question, answer, citations, reason)
  values (c.institute_id, c.subject_id, m.id, c.user_id, coalesce(q, ''), m.content, m.citations, left(why, 500))
  on conflict (message_id) do nothing
  returning id into rid;
  return rid;
end $$;

-- ---------------------------------------------------------------- 8
create or replace function private.grade_objective(qtype text, key jsonb, response jsonb, marks numeric, negative numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when qtype = 'written' then null
    when response is null or response in ('null'::jsonb, '[]'::jsonb) then 0
    when qtype = 'single' then
      case when (select array_agg(distinct x order by x) from jsonb_array_elements_text(response) x)
              = (select array_agg(distinct x order by x) from jsonb_array_elements_text(key -> 'correct') x)
           then marks else -negative end
    when qtype = 'multi' then
      case when jsonb_typeof(response) <> 'array' or not (response <@ (key -> 'correct')) then -negative
           when (key -> 'correct') <@ response then marks
           else least((select count(distinct x) from jsonb_array_elements_text(response) x) * marks / 4,
                      (select count(distinct x) from jsonb_array_elements_text(response) x) * marks
                        / jsonb_array_length(key -> 'correct')) end
    when qtype = 'numerical' and jsonb_typeof(response) = 'number' then
      case when abs((response #>> '{}')::numeric - (key ->> 'value')::numeric)
                <= coalesce((key ->> 'tolerance_abs')::numeric,
                            abs((key ->> 'value')::numeric) * (key ->> 'tolerance_pct')::numeric / 100, 0)
           then marks else -negative end
    else -negative
  end
$$;

-- ---------------------------------------------------------------- 11
-- New columns: revealed (per-question marks visible), pending (written answer not checked yet), score (live total).
drop function public.get_attempt_review(uuid);
drop function private.get_attempt_review(uuid);
create function private.get_attempt_review(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, explanation text,
               response jsonb, key jsonb, marks numeric, marks_awarded numeric, teacher_comment text,
               revealed boolean, pending boolean, score numeric)
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
  select r.question_id, r.pos, r.type, r.stem, r.options, r.explanation, r.response, r.key, r.marks,
         case when released or closed then r.live end, r.teacher_comment,
         released or closed, r.live is null, coalesce(sum(r.live) over (), 0)
  from (
    select q.id as question_id, array_position(x.question_order, q.id) as pos, q.type, q.stem, q.options,
           case when released or (closed and q.type <> 'written') then q.explanation end as explanation,
           aa.response,
           case when released or (closed and q.type <> 'written') then k.key end as key,
           tq.marks,
           case when released or aa.attempt_id is null then coalesce(aa.marks_awarded, 0)
                when q.type = 'written' or aa.graded_by is not null then aa.marks_awarded
                else private.grade_objective(q.type, k.key, aa.response, tq.marks, tq.negative_marks) end as live,
           aa.teacher_comment
    from public.test_attempts x
    join public.test_questions tq on tq.test_id = x.test_id
    join public.questions q on q.id = tq.question_id
    join public.question_keys k on k.question_id = q.id
    left join public.attempt_answers aa on aa.attempt_id = x.id and aa.question_id = q.id
    where x.id = a
  ) r
  order by r.pos;
end $$;
create function public.get_attempt_review(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, explanation text,
               response jsonb, key jsonb, marks numeric, marks_awarded numeric, teacher_comment text,
               revealed boolean, pending boolean, score numeric)
language sql stable security invoker set search_path = '' as $$ select * from private.get_attempt_review(a) $$;
revoke execute on function private.get_attempt_review(uuid), public.get_attempt_review(uuid) from public;
grant execute on function private.get_attempt_review(uuid), public.get_attempt_review(uuid) to authenticated;
