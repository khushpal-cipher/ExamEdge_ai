-- LAUNCH_PLAN step 1, ADR-058: the free pilot. New institutes start as a 7-day pilot with seat caps and $5 of AI for
-- its whole life; from midnight IST after pilot_end the institute is read-only (members write nothing, AI off), but an
-- attempt already started can still be answered and submitted. The worker and platform admins keep working.
begin;
select tests.setup();
select * from no_plan();

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
create temp table d on commit drop as select (now() at time zone 'Asia/Kolkata')::date as today;
grant select on d to authenticated, worker;
grant usage on schema tests to worker;

-- ---------------------------------------------------------------- create_institute
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.create_institute('pilotx', 'Pilot X', 'pilotx.localhost', 'o@pilotx.test', 40) $$,
  'platform admin creates a pilot with "How many students do you have?"');
select results_eq($$ select status, pilot_end, expected_students from public.institutes where slug = 'pilotx' $$,
  $$ select 'pilot'::text, (select today + 7 from d), 40 $$, 'it is a pilot ending in 7 days (India date)');
select results_eq($$ select max_students, max_staff, monthly_ai_budget_micro_usd, hard_stop
  from public.institute_quotas where institute_id = tests.inst('pilotx') $$,
  $$ values (5, 20, 5000000::bigint, true) $$, 'with 5 students, 20 staff and $5 of AI, hard stop on');
select lives_ok($$ select public.create_institute('pilotz', 'Pilot Z', 'pilotz.localhost', 'o@pilotz.test', null,
  (select today + 30 from d)) $$, 'the founder can type another end date');
select is((select pilot_end from public.institutes where slug = 'pilotz'), (select today + 30 from d),
  'and it is kept');
select throws_ok($$ select public.create_institute('pilotq', 'Pilot Q', 'pilotq.localhost', 'o@pilotq.test', null,
  (select today - 1 from d)) $$, 'P0001', 'pilot_end_past', 'an end date in the past is refused');

-- Every tenant table gets the read-only trigger, including tables added later.
select is_empty($$ select c.table_name::text from information_schema.columns c
  join information_schema.tables x using (table_schema, table_name)
  where c.table_schema = 'public' and c.column_name = 'institute_id' and x.table_type = 'BASE TABLE'
    and c.table_name not in ('usage_records', 'usage_counters', 'audit_events')
    and not exists (select 1 from pg_trigger t where t.tgrelid = format('public.%I', c.table_name)::regclass
                    and t.tgname = 'guard_read_only' and t.tgenabled <> 'D') $$,
  'every public table with institute_id (except metering and audit) has the guard_read_only trigger');

-- ---------------------------------------------------------------- a test running when the pilot ends
select tests.login('teacher1@alpha.test');
select lives_ok(format($$
  insert into public.questions (institute_id, subject_id, type, stem, options)
  values (%1$L, %2$L, 'single', 'Pilot Q', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]');
  insert into public.question_keys select id, %1$L, '{"correct":["a"]}' from public.questions where stem = 'Pilot Q';
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds)
  values (%1$L, 'Pilot test', now() - interval '1 hour', now() + interval '1 hour', 3600);
  insert into public.test_questions (test_id, question_id, institute_id)
  select t.id, q.id, %1$L from public.tests t, public.questions q where t.title = 'Pilot test' and q.stem = 'Pilot Q';
  insert into public.test_audience select id, %3$L, %1$L from public.tests where title = 'Pilot test';
  update public.tests set status = 'scheduled' where title = 'Pilot test' $$,
  tests.inst('alpha'), tests.id_of('subjects', 'name', 'Physics'),
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X')),
  'a live test for Batch X');
select tests.login('student1@alpha.test');
select isnt(public.start_attempt(tests.id_of('tests', 'title', 'Pilot test')), null, 'student1 starts it');

-- ---------------------------------------------------------------- the pilot ends
select tests.logout();
update public.institutes set status = 'pilot', pilot_end = (select today from d) where slug = 'alpha';
select is(private.read_only(tests.inst('alpha')), false, 'the last pilot day is not read-only yet');
update public.institutes set pilot_end = (select today - 1 from d) where slug = 'alpha';
select is(private.read_only(tests.inst('alpha')), true, 'from midnight IST after pilot_end it is read-only');
select is(private.read_only(tests.inst('bravo')), false, 'other institutes are not affected');
select is(private.read_only(tests.inst('pilotx')), false, 'a running pilot is not read-only');

select tests.login('student1@alpha.test');
select ok((select count(*) from public.subjects) > 0, 'members still read everything');
select lives_ok(format($$ select public.save_answer(%L, %L, '["a"]') $$,
  tests.attempt('Pilot test', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Pilot Q')),
  'the attempt already started can still be answered');
select lives_ok(format($$ select public.submit_attempt(%L) $$, tests.attempt('Pilot test', 'student1@alpha.test')),
  'and submitted');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), 'ai_disabled',
  'AI is off');
select throws_ok($$ insert into public.reviews (institute_id, batch_id, body)
  select institute_id, id, 'late' from public.batches where name = 'Batch X' $$, 'P0001', 'read_only',
  'a student cannot write');

select tests.login('student2@alpha.test');
select throws_ok(format($$ select public.start_attempt(%L) $$, tests.id_of('tests', 'title', 'Pilot test')),
  'P0001', 'read_only', 'no new attempt can start');

select tests.login('teacher1@alpha.test');
select throws_ok(format($$ insert into public.chapters (institute_id, subject_id, name) values (%L, %L, 'New') $$,
  tests.inst('alpha'), tests.id_of('subjects', 'name', 'Physics')), 'P0001', 'read_only', 'a teacher cannot write');

select tests.login('owner@alpha.test');
select throws_ok($$ update public.batches set name = 'Renamed' where name = 'Batch X' $$, 'P0001', 'read_only',
  'the owner cannot write');
select throws_ok(format($$ select public.create_invitation(%L, 'late@alpha.test', 'student') $$, tests.inst('alpha')),
  'P0001', 'read_only', 'or invite');

select tests.logout();
set local role worker;
select set_config('app.institute_id', tests.inst('alpha')::text, true);
select is(tests.affected($$ delete from public.document_chunks where true $$), 1::bigint,
  'the worker still writes (retention purge, processing)');
reset role;

select tests.login('root@examedge.test', 'aal2');
select is(tests.affected(format($$ update public.institute_quotas set max_students = 50 where institute_id = %L $$,
  tests.inst('alpha'))), 1::bigint, 'the platform admin still changes its limits');
select is(tests.affected(format($$ update public.institutes set pilot_end = (select today + 3 from d) where id = %L $$,
  tests.inst('alpha'))), 1::bigint, 'and extends the pilot');
select tests.login('teacher1@alpha.test');
select lives_ok(format($$ insert into public.chapters (institute_id, subject_id, name) values (%L, %L, 'New') $$,
  tests.inst('alpha'), tests.id_of('subjects', 'name', 'Physics')), 'after the extension members write again');

-- ---------------------------------------------------------------- the pilot's AI budget covers its whole life
select tests.logout();
update public.institute_quotas set monthly_ai_budget_micro_usd = 1000, hard_stop = true
where institute_id = tests.inst('alpha');
insert into public.usage_records (institute_id, feature, provider, model, reserved_micro_usd, cost_micro_usd, outcome,
                                  settled_at, created_at)
values (tests.inst('alpha'), 'ingest_embed', 'fake', 'fake', 1000, 1000, 'ok', now(),
        date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' - interval '1 day');
select tests.login('student2@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), 'budget',
  'last month''s spend still counts against a pilot''s budget');
select tests.logout();
update public.institutes set status = 'active' where slug = 'alpha';
select tests.login('student2@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), null,
  'an active institute''s budget is per calendar month');

-- ---------------------------------------------------------------- seat caps (bravo: 3 students, 3 staff, 1 pending)
select tests.logout();
update public.institute_quotas set max_students = 3, max_staff = 3 where institute_id = tests.inst('bravo');
select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.create_invitation(%L, 'x@bravo.test', 'student') $$, tests.inst('bravo')),
  'P0001', 'seats_full', 'no student invitation over the cap (pending invitations hold a seat)');
select throws_ok(format($$ select public.create_invitation(%L, 't@bravo.test', 'teacher') $$, tests.inst('bravo')),
  'P0001', 'seats_full', 'no staff invitation over the cap');
select lives_ok(format($$ update public.memberships set role = 'admin' where id = %L $$, tests.mid('teacher1@bravo.test')),
  'a teacher made admin at the cap is not counted twice');

select tests.logout();
select tests.create_user('new@bravo.test');
select tests.login('new@bravo.test');
select throws_ok($$ select public.accept_invitation('tok-bravo') $$, 'P0001', 'seats_full',
  'a 4th student cannot join, even with an invitation sent before the cap');

select tests.login('owner@bravo.test');
select lives_ok(format($$ update public.memberships set status = 'removed' where id = %L $$,
  tests.mid('student3@bravo.test')), 'owner removes a student');
select tests.login('new@bravo.test');
select is(public.accept_invitation('tok-bravo'), tests.inst('bravo'), 'the freed seat can be taken');
select tests.login('owner@bravo.test');
select throws_ok(format($$ update public.memberships set status = 'active' where id = %L $$,
  tests.mid('student3@bravo.test')), 'P0001', 'seats_full', 'bringing a removed student back needs a free seat');

select tests.logout();
update public.institute_quotas set max_staff = 4 where institute_id = tests.inst('bravo');
select tests.login('owner@bravo.test');
select lives_ok(format($$ select public.create_invitation(%L, 't@bravo.test', 'teacher') $$, tests.inst('bravo')),
  'the owner never takes a staff seat (3 staff + owner, cap 4)');
select throws_ok(format($$ select public.create_invitation(%L, 't2@bravo.test', 'admin') $$, tests.inst('bravo')),
  'P0001', 'seats_full', 'the pending teacher invitation holds the 4th seat');

select * from finish();
rollback;
