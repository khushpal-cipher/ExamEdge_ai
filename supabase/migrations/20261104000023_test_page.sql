-- R1.2 item 1 (ADR-042): a test is made on the Tests page for one subject (and so its batch), then filled on its page
-- with AI-made or typed questions. `add_test_questions` replaces `add_ai_test` (the topic page's AI test tab is gone).

alter table public.tests add column subject_id uuid,
  add foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete set null (subject_id);
create index on public.tests (subject_id);
grant insert (subject_id) on public.tests to authenticated;

drop function public.add_ai_test(uuid, uuid, uuid, text, timestamptz, timestamptz, int, jsonb);

-- Adds questions (+ keys) to a draft test the caller may manage, appended in order, in one transaction. Every item's
-- topic must be a topic of the test's subject. origin 'ai': the review trigger keeps it a draft and the blind second
-- answer is stored; origin 'teacher': typed by the teacher, approved and teacher-verified (the column defaults).
-- Invoker: RLS on questions, question_keys and test_questions decides as well.
create function public.add_test_questions(inst uuid, test uuid, items jsonb) returns int
language plpgsql volatile security invoker set search_path = '' as $$
declare
  subject uuid;
  q jsonb;
  qid uuid;
  ai boolean;
  n int;
begin
  select t.subject_id into subject from public.tests t
  where t.institute_id = inst and t.id = test and t.status = 'draft' and private.can_manage_test(t.id);
  if subject is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 40 then
    raise exception 'invalid_items' using errcode = '23514';
  end if;
  select coalesce(max(tq.position), 0) into n from public.test_questions tq where tq.test_id = test;
  for q in select value from jsonb_array_elements(items) loop
    if coalesce(q ->> 'origin', '') not in ('ai', 'teacher') or not exists (
      select 1 from public.chapters c
      where c.institute_id = inst and c.subject_id = subject and c.id = (q ->> 'chapter_id')::uuid) then
      raise exception 'invalid_items' using errcode = '23514';
    end if;
    ai := q ->> 'origin' = 'ai';
    insert into public.questions (institute_id, subject_id, chapter_id, type, stem, options, explanation, difficulty,
                                  origin, verification)
    values (inst, subject, (q ->> 'chapter_id')::uuid, q ->> 'type', q ->> 'stem', coalesce(q -> 'options', '[]'),
            coalesce(q ->> 'explanation', ''), coalesce(q ->> 'difficulty', 'medium'), q ->> 'origin',
            case when ai then q ->> 'verification' else 'teacher_verified' end)
    returning id into qid;
    insert into public.question_keys (question_id, institute_id, key, second_solve)
    values (qid, inst, q -> 'key', case when ai then nullif(q -> 'second_solve', 'null') end);
    n := n + 1;
    insert into public.test_questions (test_id, question_id, institute_id, position, marks, negative_marks)
    values (test, qid, inst, n, coalesce((q ->> 'marks')::numeric, 4), 0);
  end loop;
  return jsonb_array_length(items);
end $$;

revoke execute on function public.add_test_questions(uuid, uuid, jsonb) from public;
grant execute on function public.add_test_questions(uuid, uuid, jsonb) to authenticated;
