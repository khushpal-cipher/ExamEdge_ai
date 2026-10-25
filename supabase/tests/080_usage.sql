-- Phase 5: AI metering and quotas (T-SEC-12, AC5.3 single-session part, AC5.4). Reserve → settle, student daily
-- counters, institute budget hard stop, global / institute / suspended kill switches, who may read usage, worker
-- reservations in the job's tenant context only. Parallel limits are proven in apps/worker/src/usage.int.test.ts.
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

create temp table rec (name text primary key, id uuid) on commit drop;
grant select, insert on rec to authenticated, worker;

-- Fixture already used 1 of student1's messages today; limit 3 leaves two.
update public.institute_quotas set student_daily_messages = 3 where institute_id = tests.inst('alpha');

-- ---------------------------------------------------------------- student daily counters
select tests.login('student1@alpha.test');
insert into rec select 'tutor1', record_id from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10);
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), null,
  'student reserves the last message of the day');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), 'quota',
  'student over the daily message limit is blocked');
select is((select value from public.usage_counters where counter_key = 'messages'), 3,
  'counter stops at the limit and the student reads their own counter');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'query_embed', 'fake', 'fake', 10)), null,
  'a search has its own daily counter, so the message limit does not block it');
insert into rec select 'premium', record_id from public.ai_reserve(tests.inst('alpha'), 'tutor_premium', 'fake', 'fake', 10);
select is((select value from public.usage_counters where counter_key = 'premium_messages'), 1,
  'premium messages use their own counter');
select is((select count(*) from public.usage_records), 0::bigint, 'student reads no usage records');

select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'nope', 'fake', 'fake', 10) $$, '22023',
  'unknown_feature', 'unknown feature is refused');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'ingest_ocr', 'fake', 'fake', 10) $$, '22023',
  'unknown_feature', 'a member cannot reserve a worker feature');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 100001) $$, '22023',
  'reserve_out_of_range', 'reserving more than one call may cost is refused');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', -1) $$, '22023',
  'reserve_out_of_range', 'a negative reserve is refused');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'tutor', 'other', 'fake', 10) $$, '23514', null,
  'unknown provider is refused');
select throws_ok($$ select * from public.ai_reserve(tests.inst('bravo'), 'query_embed', 'fake', 'fake', 10) $$, '42501',
  'not_allowed', 'alpha student cannot reserve for bravo');
select throws_ok($$ select * from private.ai_reserve_job('ingest_ocr', 'fake', 'fake', 10, null) $$, '42501', null,
  'API users cannot call the worker reservation');
select throws_ok($$ insert into public.usage_records (institute_id, feature, provider, model, reserved_micro_usd)
  values (tests.inst('alpha'), 'tutor', 'fake', 'fake', 0) $$, '42501', null, 'student cannot insert usage records');
select throws_ok($$ update public.usage_counters set value = 0 $$, '42501', null, 'student cannot reset a counter');
select throws_ok($$ delete from public.usage_counters $$, '42501', null, 'student cannot delete a counter');

-- ---------------------------------------------------------------- settle
select lives_ok($$ select public.ai_settle(tests.inst('alpha'), (select id from rec where name = 'tutor1'),
  '{"input_tokens": 120, "output_tokens": 40}', 999999, 'ok') $$, 'student settles their own pending call');
select throws_ok($$ select public.ai_settle(tests.inst('alpha'), (select id from rec where name = 'tutor1'),
  '{}', 0, 'error') $$, 'P0002', 'not_found', 'a call is settled only once');
select lives_ok($$ select public.ai_settle(tests.inst('alpha'), (select id from rec where name = 'premium'),
  '{}', 5, 'error') $$, 'a failed call is settled as error');
select is((select value from public.usage_counters where counter_key = 'premium_messages'), 0,
  'a failed call gives the counter back');
select throws_ok($$ select public.ai_settle(tests.inst('alpha'), (select id from rec where name = 'tutor1'),
  '{}', 0, 'pending') $$, '22023', 'invalid_settlement', 'settling to an invalid outcome is refused');
select tests.login('student2@alpha.test');
select throws_ok($$ select public.ai_settle(tests.inst('alpha'), (select id from rec where name = 'tutor1'),
  '{}', 0, 'ok') $$, 'P0002', 'not_found', 'a student cannot settle another student''s call');
select tests.logout();
select is((select cost_micro_usd from public.usage_records where id = (select id from rec where name = 'tutor1')), 10::bigint,
  'settled cost is capped at the reserved amount');
select is((select input_tokens from public.usage_records where id = (select id from rec where name = 'tutor1')), 120,
  'settled tokens are recorded');

-- ---------------------------------------------------------------- staff
select tests.login('teacher1@alpha.test');
select is((select count(*) from generate_series(1, 5) g, public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 10 + 0 * g) r
  where r.blocked is null), 5::bigint, 'staff features use no student daily counter (ADR-039: staff no longer use the tutor)');
select is((select count(*) from public.usage_counters), 0::bigint, 'staff calls create no counters');
select is((select count(*) from public.usage_records), 0::bigint, 'teacher reads no usage records');

select tests.login('owner@alpha.test');
select ok((select count(*) from public.usage_records) > 0, 'owner reads own institute usage');
select is((select count(*) from public.usage_records where institute_id <> tests.inst('alpha')), 0::bigint,
  'owner reads no other institute usage');
select ok((select count(*) from public.usage_counters) > 0, 'owner reads own institute counters');
select is((select count(*) from public.usage_counters where institute_id <> tests.inst('alpha')), 0::bigint,
  'owner reads no other institute counters');
select ok((select count(*) from public.usage_summary(tests.inst('alpha'))) > 0, 'owner gets the usage summary');
select is((select count(*) from public.usage_summary(tests.inst('bravo'))), 0::bigint,
  'owner gets nothing for another institute');
select is(tests.affected($$ update public.institute_quotas set ai_enabled = false $$), 0::bigint,
  'owner cannot switch AI on or off');
select tests.login('admin@alpha.test');
select ok((select count(*) from public.usage_records) > 0, 'admin reads own institute usage');
select tests.logout();

-- ---------------------------------------------------------------- budget hard stop
update public.institute_quotas set monthly_ai_budget_micro_usd = 100 + (
  select sum(case when outcome = 'pending' then reserved_micro_usd else cost_micro_usd end) from public.usage_records
  where institute_id = tests.inst('alpha')) where institute_id = tests.inst('alpha');
select tests.login('owner@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 60)), null,
  'reserve within the budget');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 60)), 'budget',
  'pending reservations count, so the budget blocks the next call');
select tests.logout();
update public.institute_quotas set hard_stop = false where institute_id = tests.inst('alpha');
select tests.login('owner@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 60)), null,
  'without hard stop the budget does not block');
select tests.logout();
select is((select count(*) from public.usage_records where outcome = 'quota_blocked' and institute_id = tests.inst('alpha')
  and reserved_micro_usd = 0), 2::bigint, 'blocked calls are recorded with nothing reserved');

-- ---------------------------------------------------------------- kill switches (AC5.4)
update public.institute_quotas set ai_enabled = false where institute_id = tests.inst('alpha');
select tests.login('owner@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 1)), 'ai_disabled',
  'institute AI switch off blocks staff');
select tests.login('student2@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 1)), 'ai_disabled',
  'institute AI switch off blocks students');
select tests.logout();
update public.institute_quotas set ai_enabled = true where institute_id = tests.inst('alpha');

select tests.login('student1@alpha.test');
select throws_ok($$ select public.set_ai_enabled(false) $$, '42501', null, 'student cannot use the global switch');
select tests.login('owner@alpha.test');
select throws_ok($$ select public.set_ai_enabled(false) $$, '42501', null, 'owner cannot use the global switch');
select tests.login('root@examedge.test');
select throws_ok($$ select public.set_ai_enabled(false) $$, '42501', null,
  'platform admin without MFA cannot use the global switch');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.set_ai_enabled(false) $$, 'platform admin with MFA turns AI off everywhere');
select is(public.ai_enabled(), false, 'global switch reads off');
select tests.login('owner@bravo.test');
select is((select blocked from public.ai_reserve(tests.inst('bravo'), 'notes_gen', 'fake', 'fake', 1)), 'ai_disabled',
  'global switch blocks every institute at once');
select tests.logout();
select is((select count(*) from public.audit_events where action = 'platform.ai_enabled'
  and actor_user_id = tests.uid('root@examedge.test') and metadata = '{"enabled": false}'), 1::bigint,
  'global switch change is audited');

-- ---------------------------------------------------------------- worker (job tenant context)
with x as (insert into public.usage_records (institute_id, feature, provider, model, reserved_micro_usd)
  values (tests.inst('bravo'), 'ingest_ocr', 'fake', 'fake', 10) returning id)
insert into rec select 'bravo', id from x;
grant usage on schema tests to worker;

set local role worker;
select set_config('app.institute_id', tests.inst('alpha')::text, true);
select is((select blocked from private.ai_reserve_job('ingest_ocr', 'fake', 'fake', 10, null)), 'ai_disabled',
  'global switch blocks the worker too');
reset role;
update private.settings set ai_enabled = true;

set local role worker;
select set_config('app.institute_id', '', true);
select throws_ok($$ select * from private.ai_reserve_job('ingest_ocr', 'fake', 'fake', 10, null) $$, '42501',
  'no_tenant_context', 'worker without a tenant context cannot reserve');
select set_config('app.institute_id', tests.inst('alpha')::text, true);
insert into rec select 'job', record_id from private.ai_reserve_job('ingest_embed', 'fake', 'fake', 10,
  '00000000-0000-0000-0000-0000000000aa');
select throws_ok($$ select * from private.ai_reserve_job('tutor', 'fake', 'fake', 10, null) $$, '22023',
  'unknown_feature', 'worker cannot reserve a member feature');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10) $$, '42501', null,
  'worker cannot call the member reservation');
select lives_ok($$ select private.ai_settle_job((select id from rec where name = 'job'), '{"units": 3}', 0, 'ok') $$,
  'worker settles its own job call');
select throws_ok($$ select private.ai_settle_job((select id from rec where name = 'bravo'), '{}', 0, 'ok') $$, 'P0002', 'not_found',
  'worker in alpha context cannot settle a bravo call');
select set_config('app.institute_id', '', true);
reset role;
select is((select institute_id from public.usage_records where id = (select id from rec where name = 'job')),
  tests.inst('alpha'), 'job reservation belongs to the context institute');
select is((select outcome || ':' || units || ':' || job_id from public.usage_records
  where id = (select id from rec where name = 'job')), 'ok:3:00000000-0000-0000-0000-0000000000aa',
  'job call settled with units and job id');
select is((select outcome from public.usage_records where id = (select id from rec where name = 'bravo')), 'pending',
  'bravo call untouched');

update public.institutes set status = 'suspended' where id = tests.inst('alpha');
set local role worker;
select set_config('app.institute_id', tests.inst('alpha')::text, true);
select is((select blocked from private.ai_reserve_job('ingest_ocr', 'fake', 'fake', 10, null)), 'ai_disabled',
  'suspended institute gets no AI');
select set_config('app.institute_id', '', true);
reset role;

-- ---------------------------------------------------------------- CR 1: searches have a daily limit
-- Limit = doubts + step-by-step doubts a day (3 + 5 here); one search was reserved above.
update private.settings set ai_enabled = true;
update public.institutes set status = 'active' where id = tests.inst('alpha');
update public.institute_quotas set hard_stop = false where institute_id = tests.inst('alpha');
select tests.login('student2@alpha.test');
select is((select count(*) from generate_series(1, 10) g,
  public.ai_reserve(tests.inst('alpha'), 'query_embed', 'fake', 'fake', 10 + 0 * g) r where r.blocked is null), 8::bigint,
  'a student gets as many searches a day as doubts (CR 1)');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'query_embed', 'fake', 'fake', 10)), 'quota',
  'the next search is blocked');
select tests.login('teacher1@alpha.test');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'query_embed', 'fake', 'fake', 10) $$, '42501',
  'not_allowed', 'staff cannot reserve the tutor search');
select tests.logout();

-- ---------------------------------------------------------------- CR 2: stale reservations settle as error
insert into public.usage_records (institute_id, user_id, feature, provider, model, reserved_micro_usd, created_at)
values (tests.inst('alpha'), tests.uid('student1@alpha.test'), 'tutor', 'fake', 'fake', 90000, now() - interval '61 minutes'),
       (tests.inst('alpha'), tests.uid('student1@alpha.test'), 'tutor', 'fake', 'fake', 90000, now() - interval '59 minutes'),
       (tests.inst('bravo'), null, 'ingest_ocr', 'fake', 'fake', 90000, now() - interval '2 hours');
select tests.login('owner@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'notes_gen', 'fake', 'fake', 1)), null,
  'a reservation runs the stale sweep');
select tests.logout();
select is((select string_agg(outcome || ':' || cost_micro_usd, ',' order by created_at) from public.usage_records
  where reserved_micro_usd = 90000 and institute_id = tests.inst('alpha')), 'error:0,pending:0',
  'a pending reservation older than 1 hour is settled as error at cost 0; a younger one stays pending (CR 2)');
select is((select outcome from public.usage_records where reserved_micro_usd = 90000 and institute_id = tests.inst('bravo')),
  'pending', 'the sweep touches only the reserving institute');
select is(private.purge_expired() ->> 'stale_reservations', '1', 'the daily purge settles stale reservations everywhere');
select is((select outcome from public.usage_records where reserved_micro_usd = 90000 and institute_id = tests.inst('bravo')),
  'error', 'the stale bravo reservation no longer holds its budget');

-- ---------------------------------------------------------------- anon
select tests.as_anon();
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10) $$, '42501', null,
  'anon cannot reserve');
select tests.logout();

select * from finish();
rollback;
