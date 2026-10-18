-- ADR-048: CBT tests. Staff switch it on; the student's own running attempt collects warnings through cbt_warning()
-- only; the 3rd warning submits it; nothing else can change the count.
begin;
select tests.setup();
select * from no_plan();

select tests.login('teacher1@alpha.test');
create temp table ids on commit drop as
  select (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as phys,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx;
grant select on ids to authenticated;
select lives_ok(format($$
  insert into public.questions (institute_id, subject_id, type, stem, options)
  values (%L, %L, 'single', 'CBT Q', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]') $$,
  tests.inst('alpha'), (select phys from ids)), 'teacher creates a question');
select lives_ok(format($$ insert into public.question_keys values (%L, %L, '{"correct":["a"]}') $$,
  tests.id_of('questions', 'stem', 'CBT Q'), tests.inst('alpha')), 'and its key');
select lives_ok(format($$
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, cbt)
  values (%1$L, 'CBT test', now() - interval '1 hour', now() + interval '1 hour', 3600, true),
         (%1$L, 'Plain test', now() - interval '1 hour', now() + interval '1 hour', 3600, false) $$,
  tests.inst('alpha')), 'teacher creates a CBT test and a plain one');
select lives_ok(format($$
  insert into public.test_questions (test_id, question_id, institute_id) values (%1$L, %3$L, %4$L), (%2$L, %3$L, %4$L);
  insert into public.test_audience values (%1$L, %5$L, %4$L), (%2$L, %5$L, %4$L);
  update public.tests set status = 'scheduled' where id in (%1$L, %2$L) $$,
  tests.id_of('tests', 'title', 'CBT test'), tests.id_of('tests', 'title', 'Plain test'),
  tests.id_of('questions', 'stem', 'CBT Q'), tests.inst('alpha'), (select bx from ids)), 'both scheduled for Batch X');
select throws_ok(format($$ update public.tests set cbt = false where id = %L $$, tests.id_of('tests', 'title', 'CBT test')),
  'P0001', 'test_already_open', 'CBT cannot be switched off once the test is open');

select tests.login('student1@alpha.test');
select is((select cbt from public.tests where title = 'CBT test'), true, 'the student''s page can read that it is CBT');
select is(tests.affected($$ update public.tests set cbt = false where true $$), 0::bigint, 'a student cannot change it');
select isnt(public.start_attempt(tests.id_of('tests', 'title', 'CBT test')), null, 'student starts the CBT test');
select isnt(public.start_attempt(tests.id_of('tests', 'title', 'Plain test')), null, 'and the plain test');
select throws_ok(format($$ select public.cbt_warning(%L) $$, tests.attempt('Plain test', 'student1@alpha.test')),
  'P0001', 'attempt_closed', 'no warnings on a test without CBT');
select throws_ok(format($$ update public.test_attempts set cbt_warnings = 0 where id = %L $$,
  tests.attempt('CBT test', 'student1@alpha.test')), '42501', null, 'the count cannot be reset directly');
select is(public.cbt_warning(tests.attempt('CBT test', 'student1@alpha.test')), 1, 'first warning');
select is(public.cbt_warning(tests.attempt('CBT test', 'student1@alpha.test')), 2, 'second warning');
select is((select status from public.test_attempts where id = tests.attempt('CBT test', 'student1@alpha.test')),
  'in_progress', 'still writing after two warnings');

select tests.login('student2@alpha.test');
select throws_ok(format($$ select public.cbt_warning(%L) $$, tests.attempt('CBT test', 'student1@alpha.test')),
  'P0001', 'attempt_closed', 'another student cannot add warnings to someone''s attempt');

select tests.login('student1@alpha.test');
select is(public.cbt_warning(tests.attempt('CBT test', 'student1@alpha.test')), 3, 'third warning');
select results_eq(format($$ select status, submitted_at is not null from public.test_attempts where id = %L $$,
  tests.attempt('CBT test', 'student1@alpha.test')), $$ values ('auto_submitted', true) $$,
  'the third warning submits the test');
select throws_ok(format($$ select public.cbt_warning(%L) $$, tests.attempt('CBT test', 'student1@alpha.test')),
  'P0001', 'attempt_closed', 'no fourth warning');
select throws_ok(format($$ select public.save_answer(%L, %L, '["a"]') $$,
  tests.attempt('CBT test', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'CBT Q')),
  'P0001', null, 'answers cannot be saved after the CBT submit');

select tests.login('teacher1@alpha.test');
select is((select cbt_warnings from public.test_attempts where id = tests.attempt('CBT test', 'student1@alpha.test')),
  3, 'the teacher sees the warning count');

select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.cbt_warning(%L) $$, tests.attempt('CBT test', 'student1@alpha.test')),
  'P0001', 'attempt_closed', 'another institute cannot touch it');

select * from finish();
rollback;
