-- Founder (2026-10-18, ADR-048): CBT mode for institute tests. The student's page stays in full screen; leaving it
-- (or switching tab/app) is a warning, counted here so a reload cannot reset it; the 3rd warning submits the attempt.
-- Only staff set it on a test (tests RLS); practice quizzes are a different table and never have it.
alter table public.tests add column cbt boolean not null default false;
grant insert (cbt), update (cbt) on public.tests to authenticated;

alter table public.test_attempts add column cbt_warnings int not null default 0 check (cbt_warnings between 0 and 3);

-- Same as before, plus: CBT cannot be switched on or off once the test is open.
create or replace function private.guard_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'scheduled' and old.status = 'draft' then
    if not exists (select 1 from public.test_questions where test_id = new.id) then
      raise exception 'test_has_no_questions' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.test_audience where test_id = new.id) then
      raise exception 'test_has_no_batches' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.test_questions tq join public.questions q on q.id = tq.question_id
               left join public.question_keys k on k.question_id = q.id
               where tq.test_id = new.id
                 and (q.status <> 'approved' or k.key is null or not private.valid_key(q.type, q.options, k.key))) then
      raise exception 'test_question_not_ready' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'draft' and old.status <> 'draft'
     and exists (select 1 from public.test_attempts where test_id = new.id) then
    raise exception 'test_has_attempts' using errcode = 'P0001';
  end if;
  if old.status = 'scheduled' and new.status = 'scheduled' and old.opens_at <= now()
     and (new.opens_at, new.closes_at, new.duration_seconds, new.cbt) is distinct from
         (old.opens_at, old.closes_at, old.duration_seconds, old.cbt) then
    raise exception 'test_already_open' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- One warning for the caller's own running attempt of a CBT test; returns the new count. The 3rd submits it
-- ('auto_submitted', like the deadline). The page saves pending answers before calling this.
create function private.cbt_warning(a uuid) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  update public.test_attempts x
  set cbt_warnings = x.cbt_warnings + 1,
      status = case when x.cbt_warnings + 1 >= 3 then 'auto_submitted' else x.status end,
      submitted_at = case when x.cbt_warnings + 1 >= 3 then least(now(), x.deadline_at) else x.submitted_at end
  from public.tests t
  where x.id = a and x.user_id = (select auth.uid()) and x.status = 'in_progress' and now() < x.deadline_at
    and t.id = x.test_id and t.cbt
  returning x.cbt_warnings into n;
  if n is null then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  return n;
end $$;
create function public.cbt_warning(a uuid) returns int
language sql volatile security invoker set search_path = '' as $$ select private.cbt_warning(a) $$;

revoke execute on function private.cbt_warning(uuid), public.cbt_warning(uuid) from public;
grant execute on function private.cbt_warning(uuid), public.cbt_warning(uuid) to authenticated;
