-- Phase 7: question bank, tests, attempts, manual checking of written answers, release with test rank and overall
-- rank, student progress (DATABASE_DESIGN §4.5; ADR-012, ADR-016, ADR-023).
-- Integrity rules: answer keys live in question_keys (staff only, never students); students reach questions only
-- through RPCs; the DB clock enforces deadlines; marks and ranks are written only by definer RPCs.

-- ---------------------------------------------------------------- tables
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  subject_id uuid not null,
  chapter_id uuid,
  type text not null check (type in ('single', 'multi', 'numerical', 'written')),
  stem text not null check (length(stem) between 1 and 5000),
  -- [{id, text}] for single/multi; [] otherwise.
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 10),
  explanation text not null default '' check (length(explanation) <= 5000),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  origin text not null default 'teacher' check (origin in ('teacher', 'ai', 'library')),
  verification text not null default 'teacher_verified'
    check (verification in ('unverified', 'dual_solve_agree', 'dual_solve_disagree', 'teacher_verified')),
  status text not null default 'approved' check (status in ('draft', 'approved', 'retired')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade,
  foreign key (institute_id, chapter_id) references public.chapters (institute_id, id) on delete set null (chapter_id)
);
create index on public.questions (institute_id, subject_id, chapter_id);

create table public.question_keys (
  question_id uuid primary key,
  institute_id uuid not null,
  -- {correct:[optionIds]} | {value, tolerance_abs | tolerance_pct} | {model_answer} (a guide, never auto-graded)
  key jsonb not null check (jsonb_typeof(key) = 'object'),
  -- Makes the composite FK one-to-one for PostgREST, so `questions(question_keys(...))` embeds an object, not a list.
  unique (institute_id, question_id),
  foreign key (institute_id, question_id) references public.questions (institute_id, id) on delete cascade
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  title text not null check (length(title) between 1 and 200),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_seconds int not null check (duration_seconds between 60 and 86400),
  shuffle_questions boolean not null default false,
  -- closed / waiting-for-checking are derived from closes_at and unmarked answers (ADR-023).
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'results_released', 'cancelled')),
  results_release_at timestamptz,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  check (closes_at > opens_at),
  check (results_release_at is null or results_release_at >= closes_at)
);
create index on public.tests (institute_id, opens_at);

create table public.test_questions (
  test_id uuid not null,
  question_id uuid not null,
  institute_id uuid not null,
  position int not null default 0,
  marks numeric(6, 2) not null default 4 check (marks > 0 and marks * 2 = floor(marks * 2)),
  negative_marks numeric(6, 2) not null default 0 check (negative_marks >= 0 and negative_marks <= marks),
  primary key (test_id, question_id),
  foreign key (institute_id, test_id) references public.tests (institute_id, id) on delete cascade,
  foreign key (institute_id, question_id) references public.questions (institute_id, id) on delete restrict
);
create index on public.test_questions (question_id);

create table public.test_audience (
  test_id uuid not null,
  batch_id uuid not null,
  institute_id uuid not null,
  primary key (test_id, batch_id),
  foreign key (institute_id, test_id) references public.tests (institute_id, id) on delete cascade,
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade
);
create index on public.test_audience (batch_id);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  test_id uuid not null,
  user_id uuid not null references auth.users on delete cascade,
  membership_id uuid not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted')),
  score numeric(8, 2),
  max_score numeric(8, 2),
  rank int,
  percentile numeric(5, 2),
  question_order uuid[] not null,
  unique (test_id, user_id),
  unique (institute_id, id),
  foreign key (institute_id, test_id) references public.tests (institute_id, id) on delete cascade,
  foreign key (institute_id, membership_id) references public.memberships (institute_id, id) on delete cascade
);
create index on public.test_attempts (institute_id, test_id, score desc);
create index on public.test_attempts (user_id);
create index on public.test_attempts (membership_id);

create table public.attempt_answers (
  attempt_id uuid not null,
  question_id uuid not null,
  institute_id uuid not null,
  -- option ids (array), a number, or typed text (string); null only for a teacher mark on an unanswered question.
  response jsonb,
  answered_at timestamptz not null default now(),
  is_correct boolean,
  marks_awarded numeric(6, 2),
  graded_by uuid references auth.users on delete set null,
  graded_at timestamptz,
  teacher_comment text check (length(teacher_comment) <= 2000),
  primary key (attempt_id, question_id),
  foreign key (institute_id, attempt_id) references public.test_attempts (institute_id, id) on delete cascade,
  foreign key (institute_id, question_id) references public.questions (institute_id, id) on delete restrict
);
create index on public.attempt_answers (question_id);

create table public.batch_standings (
  batch_id uuid not null,
  user_id uuid not null references auth.users on delete cascade,
  institute_id uuid not null,
  average_percentage numeric(6, 2) not null default 0,
  total_marks numeric(10, 2) not null default 0,
  total_max_marks numeric(10, 2) not null default 0,
  tests_counted int not null default 0,
  tests_missed int not null default 0,
  overall_rank int,
  updated_at timestamptz not null default now(),
  primary key (batch_id, user_id),
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade
);
create index on public.batch_standings (user_id);

-- ---------------------------------------------------------------- pure grading helpers (invoker, immutable)
-- A response has the right shape for its question type (single: one known option id; multi: distinct known option
-- ids; numerical: a number; written: text up to 10 000 characters).
create function private.valid_response(qtype text, options jsonb, response jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case qtype
    when 'single' then jsonb_typeof(response) = 'array' and jsonb_array_length(response) = 1
      and response <@ jsonb_path_query_array(options, '$[*].id')
    when 'multi' then jsonb_typeof(response) = 'array' and jsonb_array_length(response) >= 1
      and response <@ jsonb_path_query_array(options, '$[*].id')
      and jsonb_array_length(response) = (select count(distinct x) from jsonb_array_elements(response) x)
    when 'numerical' then jsonb_typeof(response) = 'number'
    when 'written' then jsonb_typeof(response) = 'string' and length(response #>> '{}') <= 10000
    else false
  end
$$;

-- A key is complete for its question: correct option ids exist (exactly one for single), a numeric value with a
-- non-negative tolerance, or a model answer.
create function private.valid_key(qtype text, options jsonb, key jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case qtype
    when 'single' then jsonb_typeof(key -> 'correct') = 'array' and jsonb_array_length(key -> 'correct') = 1
      and (key -> 'correct') <@ jsonb_path_query_array(options, '$[*].id')
    when 'multi' then jsonb_typeof(key -> 'correct') = 'array' and jsonb_array_length(key -> 'correct') >= 1
      and (key -> 'correct') <@ jsonb_path_query_array(options, '$[*].id')
    when 'numerical' then jsonb_typeof(key -> 'value') = 'number'
      and coalesce((key ->> 'tolerance_abs')::numeric, 0) >= 0 and coalesce((key ->> 'tolerance_pct')::numeric, 0) >= 0
    when 'written' then jsonb_typeof(key -> 'model_answer') = 'string'
    else false
  end
$$;

-- Marks for an objective answer (AC7.1). Blank = 0. Multi-correct needs the exact set (no partial marks, ADR-023).
-- Numerical: |answer − value| ≤ tolerance_abs, else ≤ tolerance_pct % of |value|, else exact. Written → null.
create function private.grade_objective(qtype text, key jsonb, response jsonb, marks numeric, negative numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when qtype = 'written' then null
    when response is null or response in ('null'::jsonb, '[]'::jsonb) then 0
    when qtype in ('single', 'multi') then
      case when (select array_agg(distinct x order by x) from jsonb_array_elements_text(response) x)
              = (select array_agg(distinct x order by x) from jsonb_array_elements_text(key -> 'correct') x)
           then marks else -negative end
    when qtype = 'numerical' and jsonb_typeof(response) = 'number' then
      case when abs((response #>> '{}')::numeric - (key ->> 'value')::numeric)
                <= coalesce((key ->> 'tolerance_abs')::numeric,
                            abs((key ->> 'value')::numeric) * (key ->> 'tolerance_pct')::numeric / 100, 0)
           then marks else -negative end
    else -negative
  end
$$;

-- ---------------------------------------------------------------- access helpers (definer)
-- Staff who may see a test: owner/admin, or a teacher who created it or teaches one of its batches.
-- Students: tests for their batch, once scheduled.
create function private.can_see_test(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tests x where x.id = t and (
      private.has_role(x.institute_id, '{owner,admin}')
      or (private.has_role(x.institute_id, '{teacher}') and (
            x.created_by = (select auth.uid())
            or exists (select 1 from public.test_audience ta where ta.test_id = t and private.teaches_batch(ta.batch_id))))
      or (x.status <> 'draft' and private.has_role(x.institute_id, '{student}') and exists (
            select 1 from public.test_audience ta where ta.test_id = t and private.in_batch(ta.batch_id)))))
$$;

-- Staff who may edit a test and its questions/audience: owner/admin, or the teacher who created it.
create function private.can_manage_test(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tests x where x.id = t and (
      private.has_role(x.institute_id, '{owner,admin}')
      or (private.has_role(x.institute_id, '{teacher}') and x.created_by = (select auth.uid()))))
$$;

create function private.test_is_draft(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tests where id = t and status = 'draft')
$$;

-- Owner/admin, or a teacher of a batch of this test that the attempt's student is in (AC7.8).
create function private.can_grade(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.test_attempts x where x.id = a and (
      private.has_role(x.institute_id, '{owner,admin}')
      or (private.has_role(x.institute_id, '{teacher}') and exists (
            select 1 from public.test_audience ta
            join public.batch_members bm on bm.batch_id = ta.batch_id and bm.membership_id = x.membership_id
            where ta.test_id = x.test_id and bm.batch_role = 'student' and private.teaches_batch(ta.batch_id)))))
$$;

-- ---------------------------------------------------------------- guards
-- Questions used by a non-draft test are frozen (edit = new question, ADR-012).
create function private.guard_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.stem, new.options, new.type) is distinct from (old.stem, old.options, old.type) and exists (
       select 1 from public.test_questions tq join public.tests t on t.id = tq.test_id
       where tq.question_id = old.id and t.status <> 'draft') then
    raise exception 'question_in_use' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard before update on public.questions for each row execute function private.guard_question();

create function private.guard_question_key() returns trigger
language plpgsql security definer set search_path = '' as $$
declare q public.questions;
begin
  select * into q from public.questions where id = new.question_id;
  if not private.valid_key(q.type, q.options, new.key) then
    raise exception 'invalid_key' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.question_keys
  for each row execute function private.guard_question_key();

-- Scheduling needs questions (approved, with valid keys) and an audience; a test with attempts cannot go back to
-- draft; times and questions of a test cannot change once it has opened.
create function private.guard_test() returns trigger
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
     and (new.opens_at, new.closes_at, new.duration_seconds) is distinct from
         (old.opens_at, old.closes_at, old.duration_seconds) then
    raise exception 'test_already_open' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard before update on public.tests for each row execute function private.guard_test();

create trigger audit after insert or update or delete on public.tests
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.question_keys
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- results (definer, internal only)
-- Overall rank of one batch (ADR-016): average percentage over the batch's released tests that closed after the
-- student joined; a missed test counts 0 %; same average (2 decimals) = same rank; no counted test = no rank.
create function private.compute_standings(b uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.batch_standings where batch_id = b;
  insert into public.batch_standings (batch_id, user_id, institute_id, average_percentage, total_marks,
                                      total_max_marks, tests_counted, tests_missed, overall_rank)
  with students as (
    select m.user_id, bm.created_at as joined_at, bm.institute_id
    from public.batch_members bm join public.memberships m on m.id = bm.membership_id
    where bm.batch_id = b and bm.batch_role = 'student' and m.status = 'active'),
  released as (
    select t.id, t.closes_at, (select sum(marks) from public.test_questions where test_id = t.id) as max_marks
    from public.tests t join public.test_audience ta on ta.test_id = t.id
    where ta.batch_id = b and t.status = 'results_released'),
  per_test as (
    select s.user_id, r.id, r.max_marks, coalesce(a.score, 0) as score, a.id is null as missed,
           case when r.max_marks > 0 then coalesce(a.score, 0) / r.max_marks * 100 else 0 end as pct
    from students s join released r on r.closes_at > s.joined_at
    left join public.test_attempts a on a.test_id = r.id and a.user_id = s.user_id),
  agg as (
    select s.user_id, s.institute_id, round(avg(p.pct), 2) as avg_pct, coalesce(sum(p.score), 0) as total,
           coalesce(sum(p.max_marks), 0) as total_max, count(p.id)::int as counted,
           (count(*) filter (where p.missed))::int as missed
    from students s left join per_test p on p.user_id = s.user_id
    group by s.user_id, s.institute_id)
  select b, user_id, institute_id, coalesce(avg_pct, 0), total, total_max, counted, missed,
         case when counted > 0 then rank() over (partition by counted > 0 order by avg_pct desc) end
  from agg;
end $$;

-- Totals, test rank (score desc, then less time taken) and percentile for one test, then every batch's overall
-- rank. Objective answers are re-marked from the current keys unless a teacher overrode them (regrade).
create function private.compute_results(t uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  update public.attempt_answers aa
  set marks_awarded = private.grade_objective(q.type, k.key, aa.response, tq.marks, tq.negative_marks),
      is_correct = private.grade_objective(q.type, k.key, aa.response, tq.marks, tq.negative_marks) = tq.marks
  from public.test_attempts a, public.questions q, public.question_keys k, public.test_questions tq
  where a.test_id = t and aa.attempt_id = a.id and q.id = aa.question_id and k.question_id = q.id
    and tq.test_id = t and tq.question_id = q.id and q.type <> 'written' and aa.graded_by is null;

  update public.test_attempts a
  set score = coalesce((select sum(marks_awarded) from public.attempt_answers where attempt_id = a.id), 0),
      max_score = (select sum(marks) from public.test_questions where test_id = t)
  where a.test_id = t;

  with r as (
    select id, rank() over (order by score desc, submitted_at - started_at) as rk,
           percent_rank() over (order by score) as pr
    from public.test_attempts where test_id = t)
  update public.test_attempts a set rank = r.rk, percentile = round(100 * r.pr::numeric, 2) from r where r.id = a.id;

  for b in select batch_id from public.test_audience where test_id = t loop
    perform private.compute_standings(b);
  end loop;
end $$;

-- ---------------------------------------------------------------- student RPCs
create function private.start_attempt(t uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  x public.tests;
  aid uuid;
begin
  select * into x from public.tests where id = t;
  if not found or x.status = 'draft' or not private.has_role(x.institute_id, '{student}') or not exists (
       select 1 from public.test_audience ta where ta.test_id = t and private.in_batch(ta.batch_id)) then
    raise exception 'test_not_found' using errcode = '42501';
  end if;
  select id into aid from public.test_attempts where test_id = t and user_id = uid;
  if found then return aid; end if; -- reconnect: same attempt, same deadline
  if x.status <> 'scheduled' or now() < x.opens_at or now() >= x.closes_at then
    raise exception 'test_not_open' using errcode = 'P0001';
  end if;
  insert into public.test_attempts (institute_id, test_id, user_id, membership_id, deadline_at, question_order)
  select x.institute_id, t, uid, private.member_id(x.institute_id),
         least(now() + make_interval(secs => x.duration_seconds), x.closes_at),
         array_agg(question_id order by case when x.shuffle_questions then random() end, position, question_id)
  from public.test_questions where test_id = t
  on conflict (test_id, user_id) do nothing
  returning id into aid;
  if aid is null then select id into aid from public.test_attempts where test_id = t and user_id = uid; end if;
  return aid;
end $$;

-- Stems and options only (never keys), in the attempt's order, with the student's saved responses.
create function private.get_attempt_questions(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, marks numeric,
               negative_marks numeric, response jsonb)
language sql stable security definer set search_path = '' as $$
  select q.id, array_position(x.question_order, q.id), q.type, q.stem, q.options, tq.marks, tq.negative_marks,
         aa.response
  from public.test_attempts x
  join public.test_questions tq on tq.test_id = x.test_id
  join public.questions q on q.id = tq.question_id
  left join public.attempt_answers aa on aa.attempt_id = x.id and aa.question_id = q.id
  where x.id = a and x.user_id = (select auth.uid())
  order by 2
$$;

-- AC7.3: only the attempt's owner, only while in progress and before the DB-clock deadline. Blank = delete.
create function private.save_answer(a uuid, q uuid, response jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.test_attempts;
  qq public.questions;
begin
  select * into x from public.test_attempts where id = a and user_id = (select auth.uid()) for update;
  if not found then raise exception 'attempt_not_found' using errcode = '42501'; end if;
  if x.status <> 'in_progress' or now() >= x.deadline_at then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;
  select qs.* into qq from public.test_questions tq join public.questions qs on qs.id = tq.question_id
  where tq.test_id = x.test_id and tq.question_id = q;
  if not found then raise exception 'question_not_in_test' using errcode = 'P0001'; end if;
  if response is null or response in ('null'::jsonb, '[]'::jsonb, '""'::jsonb) then
    delete from public.attempt_answers where attempt_id = a and question_id = q;
    return;
  end if;
  if not private.valid_response(qq.type, qq.options, response) then
    raise exception 'invalid_response' using errcode = '22023';
  end if;
  insert into public.attempt_answers (attempt_id, question_id, institute_id, response)
  values (a, q, x.institute_id, response)
  on conflict (attempt_id, question_id) do update set response = excluded.response, answered_at = now();
end $$;

create function private.submit_attempt(a uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.test_attempts
  set status = case when now() < deadline_at then 'submitted' else 'auto_submitted' end,
      submitted_at = least(now(), deadline_at)
  where id = a and user_id = (select auth.uid()) and status = 'in_progress';
  if not found then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
end $$;

-- After release only: every question with the student's answer, the key (or model answer), marks and comments.
create function private.get_attempt_review(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, explanation text,
               response jsonb, key jsonb, marks numeric, marks_awarded numeric, teacher_comment text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.test_attempts x join public.tests t on t.id = x.test_id
                 where x.id = a and x.user_id = (select auth.uid()) and t.status = 'results_released') then
    raise exception 'results_not_released' using errcode = '42501';
  end if;
  return query
  select q.id, array_position(x.question_order, q.id), q.type, q.stem, q.options, q.explanation, aa.response, k.key,
         tq.marks, coalesce(aa.marks_awarded, 0), aa.teacher_comment
  from public.test_attempts x
  join public.test_questions tq on tq.test_id = x.test_id
  join public.questions q on q.id = tq.question_id
  join public.question_keys k on k.question_id = q.id
  left join public.attempt_answers aa on aa.attempt_id = x.id and aa.question_id = q.id
  where x.id = a
  order by 2;
end $$;

-- ---------------------------------------------------------------- staff RPCs
-- Marks one answer (written answers; also a manual override for an objective one). Half marks allowed.
-- After release both ranks are recalculated at once. Audited.
create function private.grade_answer(a uuid, q uuid, marks numeric, comment text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.test_attempts;
  tq public.test_questions;
  st text;
begin
  select * into x from public.test_attempts where id = a;
  if not found or not private.can_grade(a) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if x.status = 'in_progress' and now() < x.deadline_at then
    raise exception 'attempt_in_progress' using errcode = 'P0001';
  end if;
  select * into tq from public.test_questions where test_id = x.test_id and question_id = q;
  if not found then raise exception 'question_not_in_test' using errcode = 'P0001'; end if;
  if marks is null or marks < -tq.negative_marks or marks > tq.marks or marks * 2 <> floor(marks * 2) then
    raise exception 'invalid_marks' using errcode = '22023';
  end if;
  insert into public.attempt_answers (attempt_id, question_id, institute_id, response, marks_awarded, is_correct,
                                      graded_by, graded_at, teacher_comment)
  values (a, q, x.institute_id, null, marks, marks = tq.marks, (select auth.uid()), now(), nullif(trim(comment), ''))
  on conflict (attempt_id, question_id) do update
  set marks_awarded = excluded.marks_awarded, is_correct = excluded.is_correct, graded_by = excluded.graded_by,
      graded_at = excluded.graded_at, teacher_comment = excluded.teacher_comment;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (x.institute_id, (select auth.uid()), 'user', 'attempt_answers.grade', 'test_attempts', a,
          jsonb_build_object('question_id', q, 'marks', marks));
  select status into st from public.tests where id = x.test_id;
  if st = 'results_released' then perform private.compute_results(x.test_id); end if;
end $$;

-- Releases results (or recalculates them after a regrade). Only after the test closed and every written answer is
-- marked (AC7.7). Owner/admin, or a teacher who teaches every batch of the test.
create function private.release_results(t uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare x public.tests;
begin
  select * into x from public.tests where id = t for update;
  if not found or not (
       private.has_role(x.institute_id, '{owner,admin}')
       or (private.has_role(x.institute_id, '{teacher}')
           and not exists (select 1 from public.test_audience ta
                           where ta.test_id = t and not private.teaches_batch(ta.batch_id)))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if x.status not in ('scheduled', 'results_released') then
    raise exception 'test_not_releasable' using errcode = 'P0001';
  end if;
  if now() < x.closes_at then raise exception 'test_not_closed' using errcode = 'P0001'; end if;
  update public.test_attempts set status = 'auto_submitted', submitted_at = deadline_at
  where test_id = t and status = 'in_progress';
  if exists (select 1 from public.attempt_answers aa join public.test_attempts a on a.id = aa.attempt_id
             join public.questions q on q.id = aa.question_id
             where a.test_id = t and q.type = 'written' and aa.marks_awarded is null) then
    raise exception 'unmarked_answers' using errcode = 'P0001';
  end if;
  update public.tests set status = 'results_released', results_release_at = coalesce(results_release_at, now())
  where id = t;
  perform private.compute_results(t);
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id)
  values (x.institute_id, (select auth.uid()), 'user', 'tests.release_results', 'tests', t);
end $$;

-- ---------------------------------------------------------------- progress page (AC7.9)
-- One function feeds both the teacher's view of a student and the student's "My progress", so the numbers are
-- identical. Released tests only. Caller: the student themself, owner/admin, or a teacher of the student.
create function private.student_progress(inst uuid, student uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  mid uuid;
  result jsonb;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with my_batches as (
    select bm.batch_id, bm.created_at as joined_at from public.batch_members bm
    where bm.membership_id = mid and bm.batch_role = 'student'),
  tests as (
    select distinct t.id, t.title, t.closes_at,
           (select sum(marks) from public.test_questions where test_id = t.id) as max_marks
    from public.tests t join public.test_audience ta on ta.test_id = t.id
    join my_batches b on b.batch_id = ta.batch_id and t.closes_at > b.joined_at
    where t.institute_id = inst and t.status = 'results_released'),
  answers as (
    select a.test_id, a.user_id, q.type, q.subject_id, q.chapter_id, tq.marks, coalesce(aa.marks_awarded, 0) as got,
           aa.teacher_comment, q.stem
    from tests t join public.test_attempts a on a.test_id = t.id
    join public.test_questions tq on tq.test_id = t.id
    join public.questions q on q.id = tq.question_id
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id),
  mine as (select * from answers where user_id = student),
  test_rows as (
    select t.id, t.title, t.closes_at, t.max_marks, a.score, a.rank, a.percentile,
           extract(epoch from a.submitted_at - a.started_at)::int as seconds,
           a.id is null as missed,
           (select sum(got) from mine m where m.test_id = t.id and m.type <> 'written') as objective,
           (select sum(got) from mine m where m.test_id = t.id and m.type = 'written') as written,
           (select count(*) from public.test_attempts x where x.test_id = t.id) as takers,
           (select round(avg(score), 2) from public.test_attempts x where x.test_id = t.id) as batch_average,
           (select max(score) from public.test_attempts x where x.test_id = t.id) as highest
    from tests t left join public.test_attempts a on a.test_id = t.id and a.user_id = student)
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object('batch', b.name, 'overall_rank', s.overall_rank,
               'average_percentage', s.average_percentage, 'tests_counted', s.tests_counted,
               'tests_missed', s.tests_missed,
               'batch_size', (select count(*) from public.batch_standings z where z.batch_id = s.batch_id))
               order by b.name)
      from public.batch_standings s join public.batches b on b.id = s.batch_id
      where s.user_id = student and s.batch_id in (select batch_id from my_batches)), '[]'),
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'closes_at', r.closes_at,
               'max_marks', r.max_marks, 'score', r.score, 'rank', r.rank, 'percentile', r.percentile,
               'takers', r.takers, 'seconds', r.seconds, 'missed', r.missed, 'objective', r.objective,
               'written', r.written, 'batch_average', r.batch_average, 'highest', r.highest) order by r.closes_at)
      from test_rows r), '[]'),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object('subject', s.name, 'chapter', coalesce(c.name, 'No chapter'),
               'marks', x.got, 'max_marks', x.max) order by s.name, c.position, c.name)
      from (select subject_id, chapter_id, sum(got) as got, sum(marks) as max from mine
            group by subject_id, chapter_id) x
      join public.subjects s on s.id = x.subject_id left join public.chapters c on c.id = x.chapter_id), '[]'),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'marks', got, 'max_marks', max, 'negative', neg) order by type)
      from (select type, sum(got) as got, sum(marks) as max, -sum(least(got, 0)) as neg from mine group by type) x),
      '[]'),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('subject', s.name,
               'percentage', round(100 * m.got / nullif(m.max, 0), 2),
               'batch_percentage', round(100 * b.got / nullif(b.max, 0), 2)) order by s.name)
      from (select subject_id, sum(got) as got, sum(marks) as max from mine group by subject_id) m
      join (select subject_id, sum(got) as got, sum(marks) as max from answers group by subject_id) b
        on b.subject_id = m.subject_id
      join public.subjects s on s.id = m.subject_id), '[]'),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('test', t.title, 'question', left(m.stem, 200), 'comment', m.teacher_comment)
               order by t.closes_at)
      from mine m join tests t on t.id = m.test_id where m.teacher_comment is not null), '[]'))
  into result;
  return result;
end $$;

-- ---------------------------------------------------------------- public wrappers (invoker)
create function public.start_attempt(t uuid) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.start_attempt(t) $$;
create function public.get_attempt_questions(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, marks numeric,
               negative_marks numeric, response jsonb)
language sql stable security invoker set search_path = '' as $$ select * from private.get_attempt_questions(a) $$;
create function public.save_answer(a uuid, q uuid, response jsonb) returns void
language sql volatile security invoker set search_path = '' as $$ select private.save_answer(a, q, response) $$;
create function public.submit_attempt(a uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.submit_attempt(a) $$;
create function public.get_attempt_review(a uuid)
returns table (question_id uuid, pos int, type text, stem text, options jsonb, explanation text,
               response jsonb, key jsonb, marks numeric, marks_awarded numeric, teacher_comment text)
language sql stable security invoker set search_path = '' as $$ select * from private.get_attempt_review(a) $$;
create function public.grade_answer(a uuid, q uuid, marks numeric, comment text default null) returns void
language sql volatile security invoker set search_path = '' as $$ select private.grade_answer(a, q, marks, comment) $$;
create function public.release_results(t uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.release_results(t) $$;
create function public.student_progress(inst uuid, student uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.student_progress(inst, student) $$;

-- ---------------------------------------------------------------- function privileges
revoke execute on all functions in schema private from public;
grant execute on function private.is_platform_admin(), private.has_role(uuid, text[]), private.member_id(uuid),
  private.in_batch(uuid), private.teaches_batch(uuid), private.teaches_member(uuid), private.has_subject(uuid),
  private.shares_institute_as_staff(uuid), private.create_invitation(uuid, text, text, uuid),
  private.accept_invitation(text), private.create_institute(text, text, text, text) to authenticated;
grant execute on function private.resolve_institute(text) to anon, authenticated;
grant execute on function private.can_see_test(uuid), private.can_manage_test(uuid), private.test_is_draft(uuid),
  private.can_grade(uuid), private.start_attempt(uuid), private.get_attempt_questions(uuid),
  private.save_answer(uuid, uuid, jsonb), private.submit_attempt(uuid), private.get_attempt_review(uuid),
  private.grade_answer(uuid, uuid, numeric, text), private.release_results(uuid),
  private.student_progress(uuid, uuid) to authenticated;
revoke execute on function public.start_attempt(uuid), public.get_attempt_questions(uuid),
  public.save_answer(uuid, uuid, jsonb), public.submit_attempt(uuid), public.get_attempt_review(uuid),
  public.grade_answer(uuid, uuid, numeric, text), public.release_results(uuid), public.student_progress(uuid, uuid)
  from public;
grant execute on function public.start_attempt(uuid), public.get_attempt_questions(uuid),
  public.save_answer(uuid, uuid, jsonb), public.submit_attempt(uuid), public.get_attempt_review(uuid),
  public.grade_answer(uuid, uuid, numeric, text), public.release_results(uuid), public.student_progress(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------- RLS + table privileges
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_audience enable row level security;
alter table public.test_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.batch_standings enable row level security;
revoke all on public.questions, public.question_keys, public.tests, public.test_questions, public.test_audience,
  public.test_attempts, public.attempt_answers, public.batch_standings from anon, authenticated;

-- Students never read questions or keys directly (AC7.2): only RPCs above.
grant select, insert (institute_id, subject_id, chapter_id, type, stem, options, explanation, difficulty, status),
  update (subject_id, chapter_id, type, stem, options, explanation, difficulty, status), delete
  on public.questions to authenticated;
create policy questions_staff on public.questions for all to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));

grant select, insert (question_id, institute_id, key), update (key) on public.question_keys to authenticated;
create policy question_keys_staff on public.question_keys for all to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));

-- Status 'results_released' is set only by release_results; a released test is never edited directly.
grant select, insert (institute_id, title, opens_at, closes_at, duration_seconds, shuffle_questions),
  update (title, opens_at, closes_at, duration_seconds, shuffle_questions, status), delete
  on public.tests to authenticated;
-- The creator/manager check is inline: can_see_test(id) looks the row up by id and cannot see a row being inserted,
-- so `insert … returning` (what the app does) would be refused.
create policy tests_read on public.tests for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}')
         or (created_by = (select auth.uid()) and private.has_role(institute_id, '{teacher}'))
         or private.can_see_test(id));
create policy tests_insert on public.tests for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy tests_update on public.tests for update to authenticated
  using (private.can_manage_test(id) and status <> 'results_released')
  with check (private.can_manage_test(id) and status in ('draft', 'scheduled', 'cancelled'));
create policy tests_delete on public.tests for delete to authenticated
  using (private.can_manage_test(id) and status = 'draft');

grant select, insert (test_id, question_id, institute_id, position, marks, negative_marks),
  update (position, marks, negative_marks), delete on public.test_questions to authenticated;
create policy test_questions_read on public.test_questions for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') and private.can_see_test(test_id));
create policy test_questions_write on public.test_questions for all to authenticated
  using (private.can_manage_test(test_id) and private.test_is_draft(test_id))
  with check (private.can_manage_test(test_id) and private.test_is_draft(test_id));

grant select, insert (test_id, batch_id, institute_id), delete on public.test_audience to authenticated;
create policy test_audience_read on public.test_audience for select to authenticated
  using (private.can_see_test(test_id));
create policy test_audience_insert on public.test_audience for insert to authenticated
  with check (private.can_manage_test(test_id) and private.test_is_draft(test_id) and private.teaches_batch(batch_id));
create policy test_audience_delete on public.test_audience for delete to authenticated
  using (private.can_manage_test(test_id) and private.test_is_draft(test_id));

-- Score and rank stay null until release, so a student reading their own attempt learns nothing early.
grant select on public.test_attempts to authenticated;
create policy test_attempts_read on public.test_attempts for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(institute_id, '{owner,admin}')
         or (private.has_role(institute_id, '{teacher}') and private.teaches_member(membership_id)));

-- Staff only: answers carry is_correct/marks; students see their own through the RPCs.
grant select on public.attempt_answers to authenticated;
create policy attempt_answers_read on public.attempt_answers for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') and private.can_grade(attempt_id));

grant select on public.batch_standings to authenticated;
create policy batch_standings_read on public.batch_standings for select to authenticated
  using (user_id = (select auth.uid()) or private.teaches_batch(batch_id));
