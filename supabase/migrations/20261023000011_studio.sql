-- Phase 9: Studio basics (DATABASE_DESIGN §4.4–4.5, ADR-028). Summaries, flashcards, mind maps and practice quizzes
-- generated from one chapter's published notes. Institute artifacts are drafts until staff approve and publish them
-- to batches; student artifacts are private to the student who made them (class S). Practice quizzes are graded by
-- the database and never count for rank.

-- An artifact's chapter must belong to its subject (3-column composite FK below).
alter table public.chapters add unique (institute_id, subject_id, id);

-- ---------------------------------------------------------------- tables
create table public.generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  owner_scope text not null check (owner_scope in ('institute', 'student')),
  owner_user_id uuid references auth.users (id) on delete cascade, -- set by the trigger, never by the caller
  kind text not null check (kind in ('summary', 'flashcards', 'mind_map', 'quiz')),
  subject_id uuid not null,
  chapter_id uuid not null,
  -- [{document_id, title, page_start, page_end}]; content cites them by index.
  source_refs jsonb not null default '[]' check (jsonb_typeof(source_refs) = 'array'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  model text not null check (char_length(model) between 1 and 80),
  schema_version int not null default 1,
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  usage_record_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, subject_id, chapter_id)
    references public.chapters (institute_id, subject_id, id) on delete cascade,
  check ((owner_scope = 'student') = (owner_user_id is not null)),
  check (owner_scope = 'institute' or status = 'draft'), -- a student's artifact is never shared
  check (status <> 'published' or approved_at is not null)
);
-- Generate once, reuse (AC9.2): one institute artifact per input, one per student per input.
create unique index generated_artifacts_institute_input on public.generated_artifacts
  (institute_id, kind, input_hash, prompt_version) where owner_scope = 'institute';
create unique index generated_artifacts_student_input on public.generated_artifacts
  (institute_id, owner_user_id, kind, input_hash, prompt_version) where owner_scope = 'student';
create index on public.generated_artifacts (institute_id, subject_id, created_at desc);

-- Batches that see a published institute artifact (composite FKs, like document_audience).
create table public.artifact_audience (
  artifact_id uuid not null,
  batch_id uuid not null,
  institute_id uuid not null,
  primary key (artifact_id, batch_id),
  foreign key (institute_id, artifact_id) references public.generated_artifacts (institute_id, id) on delete cascade,
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade
);
create index on public.artifact_audience (batch_id);

-- One graded try of a practice quiz. Written only by submit_practice (the database grades it).
create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  artifact_id uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'), -- {question id: option id}
  score int not null,
  max_score int not null check (max_score > 0),
  completed_at timestamptz not null default now(),
  unique (institute_id, id),
  check (score between 0 and max_score),
  foreign key (institute_id, artifact_id) references public.generated_artifacts (institute_id, id) on delete cascade
);
create index on public.practice_attempts (institute_id, user_id, completed_at desc);
create index on public.practice_attempts (artifact_id);

-- ---------------------------------------------------------------- helpers and guard
-- Readers of an artifact: its student owner; staff of the institute (institute scope); students of a batch it is
-- published to.
create function private.can_read_artifact(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.generated_artifacts g
    where g.id = a and (
      (g.owner_scope = 'student' and g.owner_user_id = (select auth.uid())
       and private.member_id(g.institute_id) is not null)
      or (g.owner_scope = 'institute' and (
            private.has_role(g.institute_id, '{owner,admin,teacher}')
            or (g.status = 'published' and exists (
                  select 1 from public.artifact_audience x where x.artifact_id = g.id and private.in_batch(x.batch_id)))))))
$$;

-- Insert: always a draft by the caller (a student's own artifact carries their id). Update: a change to the content
-- needs a fresh approval; publishing needs an audience and stamps the approver.
create function private.guard_artifact() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is null then return new; end if; -- ops scripts (seed) set every column themselves
  if tg_op = 'INSERT' then
    new.owner_user_id := case when new.owner_scope = 'student' then (select auth.uid()) end;
    new.status := 'draft';
    new.created_by := (select auth.uid());
    new.approved_by := null;
    new.approved_at := null;
    return new;
  end if;
  if new.content is distinct from old.content then new.status := 'draft'; end if;
  if new.status = 'draft' then
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'published' and old.status <> 'published' then
    if not exists (select 1 from public.artifact_audience x where x.artifact_id = new.id) then
      raise exception 'no_audience' using errcode = '23514';
    end if;
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.generated_artifacts
  for each row execute function private.guard_artifact();
-- Publishing targets are audited (ids only). Artifacts themselves are not: a student's artifact is private and the
-- audit log is readable by the institute's owner and admins.
create trigger audit after insert or update or delete on public.artifact_audience
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- RLS
alter table public.generated_artifacts enable row level security;
alter table public.artifact_audience enable row level security;
alter table public.practice_attempts enable row level security;
revoke all on public.generated_artifacts, public.artifact_audience, public.practice_attempts from anon, authenticated;

grant select, insert (institute_id, owner_scope, kind, subject_id, chapter_id, source_refs, input_hash, prompt_version,
                      model, schema_version, content, usage_record_id),
  update (content, status), delete on public.generated_artifacts to authenticated;
-- Staff and owner inline as well: a definer helper cannot see the row inside its own insert … returning.
create policy artifacts_read on public.generated_artifacts for select to authenticated
  using ((owner_scope = 'student' and owner_user_id = (select auth.uid()) and private.member_id(institute_id) is not null)
         or (owner_scope = 'institute' and private.has_role(institute_id, '{owner,admin,teacher}'))
         or private.can_read_artifact(id));
-- Subjects RLS applies inside the check: a student only makes artifacts on subjects of their own batches.
create policy artifacts_insert on public.generated_artifacts for insert to authenticated
  with check (exists (select 1 from public.subjects s
                      where s.institute_id = generated_artifacts.institute_id and s.id = generated_artifacts.subject_id)
              and case owner_scope
                    when 'institute' then private.has_role(institute_id, '{owner,admin,teacher}')
                    else owner_user_id = (select auth.uid()) and private.has_role(institute_id, '{student}') end);
create policy artifacts_update on public.generated_artifacts for update to authenticated
  using (owner_scope = 'institute' and private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (owner_scope = 'institute' and private.has_role(institute_id, '{owner,admin,teacher}'));
create policy artifacts_delete on public.generated_artifacts for delete to authenticated
  using ((owner_scope = 'student' and owner_user_id = (select auth.uid()) and private.member_id(institute_id) is not null)
         or (owner_scope = 'institute' and private.has_role(institute_id, '{owner,admin,teacher}')));

-- Teachers publish only to batches they teach (teaches_batch is also true for owner/admin).
grant select, insert (artifact_id, batch_id, institute_id), delete on public.artifact_audience to authenticated;
create policy artifact_audience_read on public.artifact_audience for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy artifact_audience_insert on public.artifact_audience for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}') and private.teaches_batch(batch_id)
              and exists (select 1 from public.generated_artifacts g
                          where g.id = artifact_id and g.owner_scope = 'institute'));
create policy artifact_audience_delete on public.artifact_audience for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') and private.teaches_batch(batch_id));

grant select on public.practice_attempts to authenticated;
create policy practice_own on public.practice_attempts for select to authenticated
  using (user_id = (select auth.uid()) and private.member_id(institute_id) is not null);

-- ---------------------------------------------------------------- definers
-- Grades a practice quiz the caller can read and records the try. Only questions of the quiz are kept; anything
-- else in `answers` is ignored.
create function private.submit_practice(art uuid, answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.generated_artifacts;
  q jsonb;
  kept jsonb := '{}';
  results jsonb := '[]';
  score int := 0;
  n int := 0;
begin
  select * into g from public.generated_artifacts where id = art;
  if g.id is null or g.kind <> 'quiz' or not private.can_read_artifact(art)
     or not private.has_role(g.institute_id, '{student}') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(answers) is distinct from 'object' then raise exception 'bad_answers' using errcode = '22023'; end if;
  for q in select * from jsonb_array_elements(g.content -> 'questions') loop
    n := n + 1;
    if jsonb_typeof(answers -> (q ->> 'id')) = 'string' then
      kept := kept || jsonb_build_object(q ->> 'id', answers ->> (q ->> 'id'));
    end if;
    if answers ->> (q ->> 'id') = q ->> 'answer' then score := score + 1; end if;
    results := results || jsonb_build_array(jsonb_build_object(
      'id', q ->> 'id', 'choice', answers ->> (q ->> 'id'), 'answer', q ->> 'answer',
      'correct', answers ->> (q ->> 'id') = q ->> 'answer'));
  end loop;
  if n = 0 then raise exception 'bad_quiz' using errcode = '22023'; end if;
  insert into public.practice_attempts (institute_id, user_id, artifact_id, answers, score, max_score)
  values (g.institute_id, (select auth.uid()), art, kept, score, n);
  return jsonb_build_object('score', score, 'max_score', n, 'results', results);
end $$;

-- Practice per chapter (counts, average, last try) for the progress page. Same callers as student_progress.
create function private.practice_activity(inst uuid, student uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mid uuid;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('subject', s.name, 'chapter', c.name, 'quizzes', x.n,
                                        'average', x.average, 'last_at', x.last_at) order by s.name, c.position, c.name)
    from (select g.chapter_id, count(*) as n, round(avg(100.0 * p.score / p.max_score), 2) as average,
                 max(p.completed_at) as last_at
          from public.practice_attempts p join public.generated_artifacts g on g.id = p.artifact_id
          where p.institute_id = inst and p.user_id = student group by g.chapter_id) x
    join public.chapters c on c.id = x.chapter_id
    join public.subjects s on s.id = c.subject_id), '[]');
end $$;

create function public.submit_practice(art uuid, answers jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select private.submit_practice(art, answers) $$;
create function public.practice_activity(inst uuid, student uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.practice_activity(inst, student) $$;

revoke execute on function private.can_read_artifact(uuid), private.guard_artifact(),
  private.submit_practice(uuid, jsonb), private.practice_activity(uuid, uuid),
  public.submit_practice(uuid, jsonb), public.practice_activity(uuid, uuid) from public;
grant execute on function private.can_read_artifact(uuid), private.guard_artifact(),
  private.submit_practice(uuid, jsonb), private.practice_activity(uuid, uuid),
  public.submit_practice(uuid, jsonb), public.practice_activity(uuid, uuid) to authenticated;
