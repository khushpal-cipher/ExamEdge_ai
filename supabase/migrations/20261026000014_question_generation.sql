-- AI-made questions for the question bank with a second, blind solve (AC7.5, AI_PIPELINE §5, ADR-032).
-- Opus writes the questions, Sonnet solves them without the key; a question whose two answers differ (or that has
-- no second answer) cannot be approved until a teacher has checked and saved it.

-- ---------------------------------------------------------------- AI feature (staff only)
-- One call writes up to 20 questions with Opus (or solves them with Sonnet): worst case ≈ 0.5 USD.
insert into private.ai_features values ('question_gen', 'member', null, 1000000);

create or replace function private.ai_reserve(inst uuid, feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.member_id(inst) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Writing bank questions is a staff feature; students cannot spend the institute budget on it.
  if feat = 'question_gen' and not private.has_role(inst, '{owner,admin,teacher}') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from private.ai_take(inst, (select auth.uid()), feat, prov, mdl, reserve, null);
end $$;

-- ---------------------------------------------------------------- second answer + review rules
-- The second AI's answer ({correct:[ids]} or {value}); staff only, like the key it was checked against.
alter table public.question_keys add column second_solve jsonb check (jsonb_typeof(second_solve) = 'object');
grant insert (second_solve) on public.question_keys to authenticated;
grant insert (origin, verification), update (verification) on public.questions to authenticated;

-- AI questions start as drafts; a draft is approved by a teacher, and only once its check passed or a teacher has
-- verified it. Verification can only move to teacher_verified, so nobody can mark a question as checked by the AI.
create function private.guard_question_review() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.origin = 'ai' then
    if new.verification not in ('unverified', 'dual_solve_agree', 'dual_solve_disagree') then
      raise exception 'invalid_verification' using errcode = '23514';
    end if;
    new.status := 'draft';
  end if;
  if tg_op = 'UPDATE' and new.verification is distinct from old.verification
     and new.verification <> 'teacher_verified' then
    raise exception 'invalid_verification' using errcode = '23514';
  end if;
  if new.status = 'approved' and new.verification in ('unverified', 'dual_solve_disagree') then
    raise exception 'question_not_verified' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger review before insert or update on public.questions
  for each row execute function private.guard_question_review();

-- Stores one generation in one transaction, in order: each item is {type, stem, options, explanation, difficulty,
-- verification, key, second_solve}. Invoker: RLS and the column grants decide (staff of `inst` only), the triggers
-- force draft status and validate every key.
create function public.add_ai_questions(inst uuid, subject uuid, chapter uuid, items jsonb) returns int
language plpgsql volatile security invoker set search_path = '' as $$
declare
  q jsonb;
  qid uuid;
  n int := 0;
begin
  for q in select value from jsonb_array_elements(items) loop
    insert into public.questions (institute_id, subject_id, chapter_id, type, stem, options, explanation, difficulty,
                                  origin, verification)
    values (inst, subject, chapter, q ->> 'type', q ->> 'stem', coalesce(q -> 'options', '[]'),
            coalesce(q ->> 'explanation', ''), coalesce(q ->> 'difficulty', 'medium'), 'ai', q ->> 'verification')
    returning id into qid;
    insert into public.question_keys (question_id, institute_id, key, second_solve)
    values (qid, inst, q -> 'key', nullif(q -> 'second_solve', 'null'));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function private.guard_question_review(), public.add_ai_questions(uuid, uuid, uuid, jsonb)
  from public;
grant execute on function private.guard_question_review(), public.add_ai_questions(uuid, uuid, uuid, jsonb)
  to authenticated;
