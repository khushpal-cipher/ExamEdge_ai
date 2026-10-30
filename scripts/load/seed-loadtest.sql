-- LOAD-TEST DATABASE ONLY (a throwaway Supabase project with all migrations applied, never the live one).
-- Creates institute "loadtest" (active, paid) with 1,000 students loadN@loadtest.test (one shared password), one batch,
-- one open test with 10 single-answer questions. Run: supabase db query --linked -f scripts/load/seed-loadtest.sql
-- The guard below refuses to run on any database that already holds an institute other than "loadtest".
do $$
begin
  if exists (select 1 from public.institutes where slug <> 'loadtest') then
    raise exception 'refusing to seed: this database holds other institutes (is it the live project?)';
  end if;
end $$;

insert into public.institutes (slug, name, status, paid_until)
values ('loadtest', 'Load Test Classes', 'active', current_date + 365)
on conflict (slug) do nothing;

update public.institute_quotas set monthly_ai_budget_micro_usd = 1000000000, max_students = null, max_staff = null
where institute_id = (select id from public.institutes where slug = 'loadtest');

insert into public.batches (institute_id, name)
select id, 'Load batch' from public.institutes where slug = 'loadtest' and not exists (select 1 from public.batches);

insert into public.subjects (institute_id, batch_id, name)
select i.id, b.id, 'Load subject' from public.institutes i join public.batches b on b.institute_id = i.id
where i.slug = 'loadtest' and not exists (select 1 from public.subjects);

insert into public.questions (institute_id, subject_id, type, stem, options)
select s.institute_id, s.id, 'single', 'Load question ' || g,
       '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]'::jsonb
from public.subjects s, generate_series(1, 10) g
where not exists (select 1 from public.questions);

insert into public.question_keys (question_id, institute_id, key)
select id, institute_id, '{"correct":["a"]}'::jsonb from public.questions
on conflict do nothing;

insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status)
select id, 'Load test', now() - interval '1 hour', now() + interval '2 days', 3600, 'scheduled'
from public.institutes where slug = 'loadtest' and not exists (select 1 from public.tests);

insert into public.test_questions (test_id, question_id, institute_id)
select t.id, q.id, t.institute_id from public.tests t, public.questions q
on conflict do nothing;

insert into public.test_audience (test_id, batch_id, institute_id)
select t.id, b.id, t.institute_id from public.tests t, public.batches b
on conflict do nothing;

-- 1,000 students, password "LoadTest-2026" for all (throwaway project only).
with pw as (select extensions.crypt('LoadTest-2026', extensions.gen_salt('bf')) as h),
u as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         'load' || g || '@loadtest.test', pw.h, now(), '{"provider":"email","providers":["email"]}',
         jsonb_build_object('full_name', 'Load Student ' || g), now(), now()
  from generate_series(1, 1000) g, pw
  on conflict do nothing
  returning id, email
),
idn as (
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email',
         now(), now(), now()
  from u
  returning user_id
),
m as (
  insert into public.memberships (institute_id, user_id, role)
  select (select id from public.institutes where slug = 'loadtest'), id, 'student' from u
  returning id, institute_id
)
insert into public.batch_members (batch_id, membership_id, institute_id, batch_role)
select (select id from public.batches limit 1), id, institute_id, 'student' from m;

select (select id from public.tests limit 1) as test_id, (select count(*) from public.memberships) as students;

-- GoTrue fails with "Database error querying schema" when these token columns are NULL on rows made by SQL.
update auth.users set confirmation_token = '', recovery_token = '', email_change = '', email_change_token_new = '',
  email_change_token_current = '', phone_change = '', phone_change_token = '', reauthentication_token = ''
where email like 'load%@loadtest.test';
