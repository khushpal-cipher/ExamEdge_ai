-- Founder (2026-10-18): a teacher typing a question on a test page sets its negative marks too. Same function as
-- migration 23, except each item's optional negative_marks (default 0; the column check keeps 0 <= it <= marks).

create or replace function public.add_test_questions(inst uuid, test uuid, items jsonb) returns int
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
    values (test, qid, inst, n, coalesce((q ->> 'marks')::numeric, 4),
            coalesce((q ->> 'negative_marks')::numeric, 0));
  end loop;
  return jsonb_array_length(items);
end $$;
