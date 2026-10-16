-- Phase 10: per-institute upload/storage limits, job concurrency (fairness + strict claim check) and the retention
-- purge (ADR-029).
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select i.slug, i.id as inst,
         (select id from public.documents d where d.institute_id = i.id and d.title = 'Physics notes') as notes,
         (select id from public.subjects s where s.institute_id = i.id and s.name = 'Physics') as physics
  from public.institutes i where i.slug in ('alpha', 'bravo');
grant select on ids to authenticated, worker;
grant usage on schema tests to worker;

create function pg_temp.add_version(slug text, size bigint) returns void language sql as $$
  insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes)
  select x.v, i.inst, i.notes,
         (select coalesce(max(version), 0) + 1 from public.document_versions where document_id = i.notes),
         i.inst || '/' || i.notes || '/' || x.v, 'application/pdf', size
  from ids i, (select gen_random_uuid() as v) x where i.slug = add_version.slug
$$;
grant execute on function pg_temp.add_version(text, bigint) to authenticated;

-- ---------------------------------------------------------------- upload + storage limits
update public.institute_quotas set max_upload_bytes = 1500 where institute_id = (select inst from ids where slug = 'alpha');
select tests.login('teacher1@alpha.test');
select throws_ok($$ select pg_temp.add_version('alpha', 2000) $$, 'P0001', 'file_too_large',
  'a file over the institute''s upload limit is refused when the upload starts');
select lives_ok($$ select pg_temp.add_version('alpha', 1500) $$, 'a file exactly at the limit is accepted');
select tests.logout();

-- alpha now stores 1000 (fixture) + 1500 bytes.
update public.institute_quotas set max_storage_bytes = 3000 where institute_id = (select inst from ids where slug = 'alpha');
select tests.login('teacher1@alpha.test');
select throws_ok($$ select pg_temp.add_version('alpha', 501) $$, 'P0001', 'storage_full',
  'an upload that would pass the institute''s storage limit is refused');
select lives_ok($$ select pg_temp.add_version('alpha', 500) $$, 'an upload that fills storage exactly is accepted');
select tests.login('teacher1@bravo.test');
select lives_ok($$ select pg_temp.add_version('bravo', 2000) $$, 'alpha''s limits do not apply to bravo');
select tests.logout();

-- ---------------------------------------------------------------- job concurrency
update public.document_versions set processing_status = 'queued' where processing_status = 'uploading';
update public.institute_quotas set max_concurrent_jobs = 1 where institute_id = (select inst from ids where slug = 'alpha');
create temp table alpha_q on commit drop as
  select id, row_number() over (order by created_at, id) as n from public.document_versions
  where institute_id = (select inst from ids where slug = 'alpha') and processing_status = 'queued';
grant select on alpha_q to worker;
select is((select count(*) from alpha_q), 2::bigint, 'fixture: alpha has two queued versions');

set local role worker;
select is((select count(*) from private.pending_jobs() where institute_id = (select inst from ids where slug = 'alpha')),
  1::bigint, 'pending_jobs hands out only max_concurrent_jobs (1) of alpha''s queued versions');
select is((select count(*) from private.pending_jobs() where institute_id = (select inst from ids where slug = 'bravo')),
  1::bigint, 'bravo''s queued version is handed out regardless of alpha''s queue');
select throws_ok($$ select private.job_slot_free() $$, '42501', 'no_tenant_context',
  'job_slot_free needs a tenant context');
select set_config('app.institute_id', (select inst::text from ids where slug = 'alpha'), true);
select ok(private.job_slot_free(), 'a slot is free while nothing of alpha runs');
select is(tests.affected($$ update public.document_versions set processing_status = 'processing', claimed_at = now()
  where id = (select id from alpha_q where n = 1) $$), 1::bigint, 'worker claims alpha''s first version');
select ok(not private.job_slot_free(), 'no slot is free while alpha runs max_concurrent_jobs versions');
reset role;
select is((select count(*) from private.pending_jobs() where institute_id = (select inst from ids where slug = 'alpha')),
  0::bigint, 'nothing more of alpha is handed out while its slot is taken');

update public.institute_quotas set max_concurrent_jobs = 2 where institute_id = (select inst from ids where slug = 'alpha');
select is((select count(*) from private.pending_jobs() where institute_id = (select inst from ids where slug = 'alpha')),
  1::bigint, 'raising the limit to 2 hands out the next version');
update public.document_versions set claimed_at = now() - interval '1 hour' where id = (select id from alpha_q where n = 1);
select is((select count(*) from private.pending_jobs() where institute_id = (select inst from ids where slug = 'alpha')),
  2::bigint, 'a stale claim (dead worker) frees its slot and is handed out again');

select tests.login('owner@alpha.test');
select throws_ok($$ select private.job_slot_free() $$, '42501', null, 'API users cannot call job_slot_free');
select throws_ok($$ select private.purge_expired() $$, '42501', null, 'API users cannot run the purge');
select tests.logout();

-- ---------------------------------------------------------------- retention purge
create temp table chats on commit drop as select
  (select inst from ids where slug = 'alpha') as inst,
  (select user_id from public.memberships m join public.institutes i on i.id = m.institute_id
   where i.slug = 'alpha' and m.role = 'student' limit 1) as uid;
insert into public.conversations (id, institute_id, user_id, subject_id, title, created_at)
select g.id, c.inst, c.uid, (select physics from ids where slug = 'alpha'), g.t, now() - interval '13 months'
from chats c, (values ('00000000-0000-4000-8000-000000000001'::uuid, 'old'),
                      ('00000000-0000-4000-8000-000000000002'::uuid, 'still active')) g (id, t);
insert into public.messages (institute_id, conversation_id, role, content, created_at)
select c.inst, m.conv, 'user', m.body, m.at from chats c, (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'old question', now() - interval '13 months'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'old question', now() - interval '13 months'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'new question', now() - interval '1 day')) m (conv, body, at);
insert into public.usage_counters (institute_id, user_id, day, counter_key, value)
select inst, uid, (now() at time zone 'Asia/Kolkata')::date - 40, 'messages', 3 from chats;
create temp table before on commit drop as select
  (select count(*) from public.messages) as messages,
  (select count(*) from public.conversations) as conversations,
  (select count(*) from public.usage_counters) as counters;
grant select on before to worker;

set local role worker;
select is(private.purge_expired(), '{"messages": 2, "conversations": 1, "usage_counters": 1, "documents": 0}'::jsonb,
  'the worker purge reports counts only');
reset role;
select is((select count(*) from public.messages), (select messages - 2 from before),
  'messages older than 12 months are deleted, newer ones stay');
select is((select count(*) from public.messages
  where conversation_id = '00000000-0000-4000-8000-000000000002' and content = 'new question'), 1::bigint,
  'a recent message in an old chat stays');
select is((select count(*) from public.conversations where id = '00000000-0000-4000-8000-000000000001'), 0::bigint,
  'an old chat with no messages left is deleted');
select is((select count(*) from public.conversations where id = '00000000-0000-4000-8000-000000000002'), 1::bigint,
  'an old chat with a recent message stays');
select is((select count(*) from public.usage_counters), (select counters - 1 from before),
  'daily counters older than 35 days are deleted, today''s stay');

select * from finish();
rollback;
