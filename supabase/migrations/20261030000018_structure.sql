-- R1.1 groups A + C (ADR-038, ADR-040): a subject belongs to one batch; Subject → Topic (table `chapters`) → Subtopic;
-- notes live in a subtopic; a student's old batch stays readable after promotion (batch_members.left_at).
-- Existing data is migrated, never dropped: a subject shared by several batches is copied once per extra batch.

-- ---------------------------------------------------------------- subjects inside batches
alter table public.subjects add column batch_id uuid;

do $$ begin
  -- An unlinked subject is deleted only if nothing points at it; content needs a person's decision.
  if exists (select 1 from public.subjects s
             where not exists (select 1 from public.batch_subjects bs where bs.subject_id = s.id)
               and (exists (select 1 from public.documents d where d.subject_id = s.id)
                    or exists (select 1 from public.questions q where q.subject_id = s.id)
                    or exists (select 1 from public.generated_artifacts g where g.subject_id = s.id)
                    or exists (select 1 from public.conversations c where c.subject_id = s.id))) then
    raise exception 'unlinked subject with content: link it to a batch first';
  end if;
end $$;
delete from public.subjects s where not exists (select 1 from public.batch_subjects bs where bs.subject_id = s.id);

-- The oldest linked batch keeps the row (and all its content).
update public.subjects s set batch_id = (
  select bs.batch_id from public.batch_subjects bs join public.batches b on b.id = bs.batch_id
  where bs.subject_id = s.id order by b.created_at, b.id limit 1);

do $$ begin
  -- Notes published to a batch that no longer studies their subject would vanish for its students.
  if exists (select 1 from public.document_audience da join public.documents d on d.id = da.document_id
             join public.subjects s on s.id = d.subject_id where da.batch_id <> s.batch_id)
     or exists (select 1 from public.artifact_audience aa join public.generated_artifacts g on g.id = aa.artifact_id
                join public.subjects s on s.id = g.subject_id where aa.batch_id <> s.batch_id) then
    raise exception 'content published to several batches of one subject: decide per batch first';
  end if;
end $$;

alter table public.subjects drop constraint subjects_institute_id_name_key;
-- Every other linked batch gets its own copy of the subject with the same topics (empty of content).
with extra as (
  select bs.batch_id, s.id as source, s.institute_id, s.name
  from public.batch_subjects bs join public.subjects s on s.id = bs.subject_id where bs.batch_id <> s.batch_id),
copies as (
  insert into public.subjects (institute_id, batch_id, name)
  select institute_id, batch_id, name from extra returning id, institute_id, batch_id, name)
insert into public.chapters (institute_id, subject_id, name, position)
select c.institute_id, copies.id, c.name, c.position
from copies join extra e
  on e.institute_id = copies.institute_id and e.batch_id = copies.batch_id and e.name = copies.name
join public.chapters c on c.subject_id = e.source;

alter table public.subjects
  alter column batch_id set not null,
  add unique (institute_id, batch_id, name),
  add foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade;
create index on public.subjects (batch_id);
drop table public.batch_subjects;
grant insert (batch_id) on public.subjects to authenticated;

-- Students (current or past) and teachers of the subject's batch read it; staff policies check roles separately.
create or replace function private.has_subject(subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subjects s where s.id = subject and private.in_batch(s.batch_id))
$$;

-- ---------------------------------------------------------------- subtopics
create table public.subtopics (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  subject_id uuid not null,
  chapter_id uuid not null,
  name text not null check (length(name) between 1 and 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  unique (institute_id, chapter_id, id),
  foreign key (institute_id, subject_id, chapter_id)
    references public.chapters (institute_id, subject_id, id) on delete cascade
);
create index on public.subtopics (institute_id, chapter_id, position);
alter table public.subtopics enable row level security;
revoke all on public.subtopics from anon, authenticated;
grant select, insert (institute_id, subject_id, chapter_id, name, position), update (name, position), delete
  on public.subtopics to authenticated;
create policy subtopics_read on public.subtopics for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.has_subject(subject_id));
create policy subtopics_insert on public.subtopics for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy subtopics_update on public.subtopics for update to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy subtopics_delete on public.subtopics for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));

-- ---------------------------------------------------------------- notes live in a subtopic
alter table public.documents add column subtopic_id uuid;
do $$
declare r record; c uuid; st uuid;
begin
  for r in select distinct institute_id, subject_id from public.documents where chapter_id is null loop
    insert into public.chapters (institute_id, subject_id, name) values (r.institute_id, r.subject_id, 'General')
    returning id into c;
    update public.documents set chapter_id = c where subject_id = r.subject_id and chapter_id is null;
  end loop;
  for r in select distinct institute_id, subject_id, chapter_id from public.documents loop
    insert into public.subtopics (institute_id, subject_id, chapter_id, name)
    values (r.institute_id, r.subject_id, r.chapter_id, 'General') returning id into st;
    update public.documents set subtopic_id = st where chapter_id = r.chapter_id;
  end loop;
end $$;
-- No action (not cascade): a topic or subtopic that still has notes cannot be deleted; deleting a subject or an
-- institute removes everything in one statement.
alter table public.documents
  drop constraint documents_institute_id_chapter_id_fkey,
  alter column chapter_id set not null,
  alter column subtopic_id set not null,
  add foreign key (institute_id, subject_id, chapter_id) references public.chapters (institute_id, subject_id, id),
  add foreign key (institute_id, chapter_id, subtopic_id) references public.subtopics (institute_id, chapter_id, id);
create index on public.documents (institute_id, subtopic_id) where deleted_at is null;
grant insert (subtopic_id), update (subtopic_id) on public.documents to authenticated;

-- "Publish" = publish to the subject's own batch (invoker: the caller already reads documents and subjects). After
-- insert, so RLS refuses a foreign row first and this check never reveals anything about it.
create function private.guard_audience_batch() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare subj uuid;
begin
  if tg_table_name = 'document_audience' then
    select d.subject_id into subj from public.documents d where d.id = new.document_id;
  else
    select g.subject_id into subj from public.generated_artifacts g where g.id = (to_jsonb(new) ->> 'artifact_id')::uuid;
  end if;
  if not exists (select 1 from public.subjects s where s.id = subj and s.batch_id = new.batch_id) then
    raise exception 'audience_not_subject_batch' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger subject_batch after insert on public.document_audience
  for each row execute function private.guard_audience_batch();
create trigger subject_batch after insert on public.artifact_audience
  for each row execute function private.guard_audience_batch();
revoke execute on function private.guard_audience_batch() from public;
grant execute on function private.guard_audience_batch() to authenticated;

-- ---------------------------------------------------------------- batch history (ADR-040)
alter table public.batch_members add column left_at timestamptz;
grant update (left_at) on public.batch_members to authenticated;
create policy batch_members_update on public.batch_members for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}')) with check (private.has_role(institute_id, '{owner,admin}'));

-- A test of a batch the student has left counts neither as taken nor as missed for them.
create or replace function private.compute_standings(b uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.batch_standings where batch_id = b;
  insert into public.batch_standings (batch_id, user_id, institute_id, average_percentage, total_marks,
                                      total_max_marks, tests_counted, tests_missed, overall_rank)
  with students as (
    select m.user_id, bm.created_at as joined_at, bm.left_at, bm.institute_id
    from public.batch_members bm join public.memberships m on m.id = bm.membership_id
    where bm.batch_id = b and bm.batch_role = 'student' and m.status = 'active'),
  released as (
    select t.id, t.opens_at, t.closes_at, (select sum(marks) from public.test_questions where test_id = t.id) as max_marks
    from public.tests t join public.test_audience ta on ta.test_id = t.id
    where ta.batch_id = b and t.status = 'results_released'),
  per_test as (
    select s.user_id, r.id, r.max_marks, coalesce(a.score, 0) as score, a.id is null as missed,
           case when r.max_marks > 0 then coalesce(a.score, 0) / r.max_marks * 100 else 0 end as pct
    from students s join released r on r.closes_at > s.joined_at and (s.left_at is null or r.opens_at < s.left_at)
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

-- A past batch is read-only for tests: a reconnect keeps working, a new attempt needs a current membership.
create or replace function private.start_attempt(t uuid) returns uuid
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
  if not exists (select 1 from public.test_audience ta join public.batch_members bm on bm.batch_id = ta.batch_id
                 where ta.test_id = t and bm.membership_id = private.member_id(x.institute_id) and bm.left_at is null) then
    raise exception 'not_current_member' using errcode = 'P0001';
  end if;
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

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
