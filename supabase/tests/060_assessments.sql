-- Phase 7: AC7.1 grading tables, AC7.2 / T-ISO-14 keys never reach students, AC7.3 DB-clock deadline, double start /
-- double submit, AC7.6 test + overall rank against a hand-computed fixture (score tie, score+time tie, missed test,
-- regrade), AC7.7 no release while written answers are unmarked, AC7.8 teachers mark only their batches,
-- AC7.9 progress is the same for the student and their teacher.
begin;
select tests.setup();
select * from no_plan();

-- ---------------------------------------------------------------- AC7.1 grading tables (pure functions)
select is(private.grade_objective('single', '{"correct":["a"]}', '["a"]', 4, 1), 4.0, 'single: correct = full marks');
select is(private.grade_objective('single', '{"correct":["a"]}', '["b"]', 4, 1), -1.0, 'single: wrong = negative');
select is(private.grade_objective('single', '{"correct":["a"]}', null, 4, 1), 0.0, 'single: blank (null) = 0');
select is(private.grade_objective('single', '{"correct":["a"]}', '[]', 4, 1), 0.0, 'single: blank ([]) = 0');
select is(private.grade_objective('multi', '{"correct":["c","a"]}', '["a","c"]', 4, 1), 4.0, 'multi: exact set, any order');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '["a"]', 4, 2), 1.0,
  'multi (JEE Advanced, migration 26): one right option of two, none wrong = +1');
select is(private.grade_objective('multi', '{"correct":["a","b","c"]}', '["a","c"]', 4, 2), 2.0,
  'multi: two right options of three = +2');
select is(private.grade_objective('multi', '{"correct":["a","b","c","d"]}', '["a","b","d"]', 4, 2), 3.0,
  'multi: three right options of four = +3');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '["c","a","a"]', 4, 2), 4.0,
  'multi: all right options (repeats ignored) = full');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '["a","b"]', 4, 2), -2.0,
  'multi: a wrong option picked = negative, even with a right one');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '["a"]', 8, 0), 2.0,
  'multi: partial = marks / 4 per right option');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '"a"', 4, 2), -2.0, 'multi: not a list = wrong');
select is(private.grade_objective('multi', '{"correct":["a","c"]}', '["a","b","c"]', 4, 1), -1.0, 'multi: superset = wrong');
select is(private.grade_objective('numerical', '{"value":9.8,"tolerance_abs":0.1}', '9.85', 4, 1), 4.0,
  'numerical: inside absolute tolerance');
select is(private.grade_objective('numerical', '{"value":9.8,"tolerance_abs":0.1}', '9.9', 4, 1), 4.0,
  'numerical: on the absolute tolerance edge');
select is(private.grade_objective('numerical', '{"value":9.8,"tolerance_abs":0.1}', '9.95', 4, 1), -1.0,
  'numerical: outside absolute tolerance');
select is(private.grade_objective('numerical', '{"value":-200,"tolerance_pct":1}', '-198', 4, 0), 4.0,
  'numerical: inside percentage tolerance (of |value|)');
select is(private.grade_objective('numerical', '{"value":-200,"tolerance_pct":1}', '-197.9', 4, 0), 0.0,
  'numerical: outside percentage tolerance, no negative marks');
select is(private.grade_objective('numerical', '{"value":3}', '3', 4, 1), 4.0, 'numerical: exact without tolerance');
select is(private.grade_objective('numerical', '{"value":3}', '3.001', 4, 1), -1.0, 'numerical: not exact');
select is(private.grade_objective('written', '{"model_answer":"x"}', '"anything"', 5, 0), null,
  'written: never auto-graded');

select ok(private.valid_response('single', '[{"id":"a"},{"id":"b"}]', '["a"]'), 'response: single with one known option');
select ok(not private.valid_response('single', '[{"id":"a"},{"id":"b"}]', '["a","b"]'), 'response: single with two options');
select ok(not private.valid_response('single', '[{"id":"a"}]', '["z"]'), 'response: unknown option id');
select ok(not private.valid_response('multi', '[{"id":"a"},{"id":"b"}]', '["a","a"]'), 'response: repeated option');
select ok(private.valid_response('numerical', '[]', '5.5'), 'response: number');
select ok(not private.valid_response('numerical', '[]', '"5.5"'), 'response: numeric text is not a number');
select ok(private.valid_response('written', '[]', '"my answer"'), 'response: written text');
select ok(not private.valid_response('written', '[]', to_jsonb(repeat('x', 10001))), 'response: written text too long');
select ok(not private.valid_key('single', '[{"id":"a"},{"id":"b"}]', '{"correct":["a","b"]}'), 'key: single needs one');
select ok(not private.valid_key('multi', '[{"id":"a"}]', '{"correct":["z"]}'), 'key: unknown option');
select ok(not private.valid_key('numerical', '[]', '{"value":"9.8"}'), 'key: numerical value must be a number');
select ok(private.valid_key('written', '[]', '{"model_answer":"F = ma"}'), 'key: written model answer');

-- ---------------------------------------------------------------- fixture: everyone joined Batch X 20 hours ago
-- (after the helper's fixture test closed, before every test below). student3 also joins Batch X.
-- Both institutes have a 'Batch X'; keep alpha's id.
create temp table bx on commit drop as
  select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X';
grant select on bx to authenticated;
insert into public.batch_members (batch_id, membership_id, institute_id, batch_role)
select id, tests.mid('student3@alpha.test'), tests.inst('alpha'), 'student' from bx;
update public.batch_members set created_at = now() - interval '20 hours' where institute_id = tests.inst('alpha');

-- ---------------------------------------------------------------- teacher builds and schedules Unit 1
select tests.login('teacher1@alpha.test');
create temp table phys on commit drop as
  select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics';
select lives_ok(format($$
  insert into public.questions (institute_id, subject_id, type, stem, options) values
    (%1$L, %2$L, 'single', 'Q1 single', '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"}]'),
    (%1$L, %2$L, 'multi', 'Q2 multi', '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"}]'),
    (%1$L, %2$L, 'numerical', 'Q3 numerical', '[]'),
    (%1$L, %2$L, 'written', 'Q4 written', '[]'),
    (%1$L, %2$L, 'single', 'Q5 no key', '[{"id":"a","text":"A"}]') $$,
  tests.inst('alpha'), (select id from pg_temp.phys)), 'teacher creates questions of every type');
select throws_ok(format($$ insert into public.question_keys values (%L, %L, '{"correct":["z"]}') $$,
  tests.id_of('questions', 'stem', 'Q1 single'), tests.inst('alpha')), '23514', 'invalid_key',
  'a key must match the question''s options');
select lives_ok(format($$ insert into public.question_keys values
    (%1$L, %5$L, '{"correct":["a"]}'), (%2$L, %5$L, '{"correct":["a","c"]}'),
    (%3$L, %5$L, '{"value":9.8,"tolerance_abs":0.1}'), (%4$L, %5$L, '{"model_answer":"Torque = r x F"}') $$,
  tests.id_of('questions', 'stem', 'Q1 single'), tests.id_of('questions', 'stem', 'Q2 multi'),
  tests.id_of('questions', 'stem', 'Q3 numerical'), tests.id_of('questions', 'stem', 'Q4 written'),
  tests.inst('alpha')), 'teacher sets keys');
select lives_ok(format($$
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds)
  values (%1$L, 'Unit 1', now() - interval '1 hour', now() + interval '1 hour', 3600),
         (%1$L, 'Not ready', now() - interval '1 hour', now() + interval '1 hour', 3600),
         (%1$L, 'Secret draft', now() - interval '1 hour', now() + interval '1 hour', 3600) $$, tests.inst('alpha')),
  'teacher creates tests');
select lives_ok(format($$
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds)
  values (%L, 'Read back', now(), now() + interval '1 hour', 3600) returning id $$, tests.inst('alpha')),
  'teacher reads back the test they just created (insert … returning, as the app does)');
select lives_ok(format($$
  insert into public.test_questions (test_id, question_id, institute_id, position, marks, negative_marks) values
    (%1$L, %2$L, %6$L, 1, 4, 1), (%1$L, %3$L, %6$L, 2, 4, 1), (%1$L, %4$L, %6$L, 3, 4, 1), (%1$L, %5$L, %6$L, 4, 5, 0) $$,
  tests.id_of('tests', 'title', 'Unit 1'), tests.id_of('questions', 'stem', 'Q1 single'),
  tests.id_of('questions', 'stem', 'Q2 multi'), tests.id_of('questions', 'stem', 'Q3 numerical'),
  tests.id_of('questions', 'stem', 'Q4 written'), tests.inst('alpha')), 'teacher adds questions with marks');
select throws_ok(format($$ update public.tests set status = 'scheduled' where id = %L $$,
  tests.id_of('tests', 'title', 'Unit 1')), 'P0001', 'test_has_no_batches', 'cannot schedule without batches');
select throws_ok(format($$ insert into public.test_audience
    select %L, id, %L from public.batches where institute_id = %3$L and name = 'Batch Y' $$,
  tests.id_of('tests', 'title', 'Unit 1'), tests.inst('alpha'), tests.inst('alpha')), '42501', null,
  'teacher cannot target a batch they do not teach');
select lives_ok(format($$ insert into public.test_audience select %L, id, %L from pg_temp.bx $$,
  tests.id_of('tests', 'title', 'Unit 1'), tests.inst('alpha')), 'teacher targets own batch');
select lives_ok(format($$ insert into public.test_audience select %L, id, %L from pg_temp.bx $$,
  tests.id_of('tests', 'title', 'Secret draft'), tests.inst('alpha')), 'draft test targets own batch');
select lives_ok(format($$ update public.tests set status = 'scheduled' where id = %L $$,
  tests.id_of('tests', 'title', 'Unit 1')), 'teacher schedules Unit 1');
select lives_ok(format($$
  insert into public.test_questions (test_id, question_id, institute_id) values (%L, %L, %L);
  insert into public.test_audience select %1$L, id, %3$L from pg_temp.bx $$,
  tests.id_of('tests', 'title', 'Not ready'), tests.id_of('questions', 'stem', 'Q5 no key'), tests.inst('alpha')),
  'second test gets a question without a key');
select throws_ok(format($$ update public.tests set status = 'scheduled' where id = %L $$,
  tests.id_of('tests', 'title', 'Not ready')), 'P0001', 'test_question_not_ready', 'cannot schedule a question without key');
select throws_ok(format($$ update public.questions set stem = 'changed' where id = %L $$,
  tests.id_of('questions', 'stem', 'Q1 single')), 'P0001', 'question_in_use', 'questions of a scheduled test are frozen');
select throws_ok(format($$ insert into public.test_questions (test_id, question_id, institute_id) values (%L, %L, %L) $$,
  tests.id_of('tests', 'title', 'Unit 1'), tests.id_of('questions', 'stem', 'Q5 no key'), tests.inst('alpha')), '42501',
  null, 'questions of a scheduled test cannot change');

-- ---------------------------------------------------------------- AC7.2 / T-ISO-14: students never see keys
select tests.login('student1@alpha.test');
select is((select count(*) from public.questions), 0::bigint, 'student cannot read questions');
select is((select count(*) from public.question_keys), 0::bigint, 'student cannot read keys');
select is((select count(*) from public.test_questions), 0::bigint, 'student cannot read test questions');
select set_eq($$ select title from public.tests $$, array['Unit 1', 'Fixture test'],
  'student sees scheduled/released tests of own batch, never drafts');
select throws_ok($$ select private.compute_results(id) from public.tests $$, '42501', null,
  'student cannot call internal result functions');
select throws_ok(format($$ select public.start_attempt(%L) $$, tests.id_of('tests', 'title', 'Secret draft')),
  '42501', 'test_not_found', 'student cannot start a draft test');

select isnt(public.start_attempt(tests.id_of('tests', 'title', 'Unit 1')), null, 'student starts Unit 1');
select is(public.start_attempt(tests.id_of('tests', 'title', 'Unit 1')), tests.attempt('Unit 1', 'student1@alpha.test'),
  'starting again (reconnect) returns the same attempt');
select is((select deadline_at from public.test_attempts where id = tests.attempt('Unit 1', 'student1@alpha.test')), now() + interval '1 hour',
  'deadline = least(start + duration, closes_at), from the DB clock');
select is((select count(*) from public.get_attempt_questions(tests.attempt('Unit 1', 'student1@alpha.test'))), 4::bigint,
  'student gets the 4 questions (stems/options only)');
select is((select score from public.test_attempts where id = tests.attempt('Unit 1', 'student1@alpha.test')), null, 'no score before release');
select lives_ok(format($$
  select public.save_answer(%1$L, %2$L, '["a"]'), public.save_answer(%1$L, %3$L, '["c","a"]'),
         public.save_answer(%1$L, %4$L, '9.85'), public.save_answer(%1$L, %5$L, '"A torque turns things"') $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single'),
  tests.id_of('questions', 'stem', 'Q2 multi'), tests.id_of('questions', 'stem', 'Q3 numerical'),
  tests.id_of('questions', 'stem', 'Q4 written')), 'student saves answers');
select is((select response from public.get_attempt_questions(tests.attempt('Unit 1', 'student1@alpha.test'))
           where type = 'multi'), '["c","a"]'::jsonb, 'saved answer comes back on reconnect');
select throws_ok(format($$ select public.save_answer(%L, %L, '["z"]') $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single')), '22023',
  'invalid_response', 'malformed answer rejected');
select throws_ok(format($$ select public.save_answer(%L, %L, '["a"]') $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q5 no key')), 'P0001',
  'question_not_in_test', 'answer to a question outside the test rejected');
select throws_ok(format($$ select * from public.get_attempt_review(%L) $$, tests.attempt('Unit 1', 'student1@alpha.test')),
  '42501', 'results_not_released', 'no review (keys) before release');
select lives_ok(format($$ select public.submit_attempt(%L) $$, tests.attempt('Unit 1', 'student1@alpha.test')),
  'student submits');
select throws_ok(format($$ select public.submit_attempt(%L) $$, tests.attempt('Unit 1', 'student1@alpha.test')),
  'P0001', 'attempt_closed', 'double submit rejected');
select throws_ok(format($$ select public.save_answer(%L, %L, '["b"]') $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single')), 'P0001',
  'attempt_closed', 'no saves after submit');

select tests.login('student2@alpha.test');
select throws_ok(format($$ select public.save_answer(%L, %L, '["b"]') $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single')), '42501',
  'attempt_not_found', 'a student cannot write into another student''s attempt');
select lives_ok(format($$ select public.start_attempt(%1$L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  'student2 starts');
select is((select count(*) from public.test_attempts where test_id = tests.id_of('tests', 'title', 'Unit 1')), 1::bigint,
  'student2 sees only own attempt');
select lives_ok(format($$
  select public.save_answer(%1$L, %2$L, '["b"]'), public.save_answer(%1$L, %3$L, '9.8'),
         public.save_answer(%1$L, %4$L, '"short"') $$,
  tests.attempt('Unit 1', 'student2@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single'),
  tests.id_of('questions', 'stem', 'Q3 numerical'), tests.id_of('questions', 'stem', 'Q4 written')),
  'student2 saves answers');

-- AC7.3: the deadline passes (DB clock) while student2 is still in the test.
select tests.logout();
update public.test_attempts set started_at = now() - interval '2 hours', deadline_at = now() - interval '90 minutes'
where id = tests.attempt('Unit 1', 'student2@alpha.test');
select tests.login('student2@alpha.test');
select throws_ok(format($$ select public.save_answer(%L, %L, '["a"]') $$,
  tests.attempt('Unit 1', 'student2@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single')), 'P0001',
  'attempt_closed', 'save after the deadline rejected by the database (AC7.3)');

select tests.login('teacher1@alpha.test');
select throws_ok(format($$ select public.release_results(%L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  'P0001', 'test_not_closed', 'cannot release before the test closes');

-- ---------------------------------------------------------------- time passes: Unit 1 closes
-- Times are fixed so the tie-break is exact: student1 took 20 min, student3 25 min, student2 hit the 30 min deadline.
select tests.logout();
alter table public.tests disable trigger guard; -- fixture time travel only
update public.tests set opens_at = now() - interval '3 hours', closes_at = now() - interval '1 minute'
where id = tests.id_of('tests', 'title', 'Unit 1');
update public.test_attempts set started_at = now() - interval '2 hours',
  submitted_at = now() - interval '2 hours' + interval '20 minutes', deadline_at = now() - interval '1 hour'
where id = tests.attempt('Unit 1', 'student1@alpha.test');
update public.test_attempts set deadline_at = now() - interval '2 hours' + interval '30 minutes'
where id = tests.attempt('Unit 1', 'student2@alpha.test');
insert into public.test_attempts (institute_id, test_id, user_id, membership_id, started_at, deadline_at, submitted_at,
                                  status, question_order)
select tests.inst('alpha'), tests.id_of('tests', 'title', 'Unit 1'), tests.uid('student3@alpha.test'),
       tests.mid('student3@alpha.test'), now() - interval '2 hours', now() - interval '1 hour',
       now() - interval '2 hours' + interval '25 minutes', 'submitted', question_order
from public.test_attempts where id = tests.attempt('Unit 1', 'student1@alpha.test');
insert into public.attempt_answers (attempt_id, question_id, institute_id, response) values
  (tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q1 single'), tests.inst('alpha'), '["a"]'),
  (tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q2 multi'), tests.inst('alpha'), '["a","c"]'),
  (tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q3 numerical'), tests.inst('alpha'), '9.75'),
  (tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written'), tests.inst('alpha'), '"Turning force"');
alter table public.tests enable trigger guard;

-- ---------------------------------------------------------------- AC7.7 / AC7.8 checking
select tests.login('teacher1@alpha.test');
select throws_ok(format($$ select public.release_results(%L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  'P0001', 'unmarked_answers', 'cannot release while written answers are unmarked (AC7.7)');
select is((select count(*) from public.attempt_answers aa join public.questions q on q.id = aa.question_id
           where q.type = 'written' and aa.marks_awarded is null), 3::bigint,
  'checking screen sees 3 written answers to mark');

select tests.login('teacher2@alpha.test');
select throws_ok(format($$ select public.grade_answer(%L, %L, 3) $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')), '42501', 'not_allowed',
  'a teacher of another batch cannot mark these answers (AC7.8)');
select is((select count(*) from public.attempt_answers), 0::bigint, 'nor read them');
select throws_ok(format($$ select public.release_results(%L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  '42501', 'not_allowed', 'nor release the test');
select tests.login('student1@alpha.test');
select throws_ok(format($$ select public.grade_answer(%L, %L, 5) $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')), '42501', 'not_allowed',
  'a student cannot mark their own answer');

select tests.login('teacher1@alpha.test');
select throws_ok(format($$ select public.grade_answer(%L, %L, 5.5) $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')), '22023', 'invalid_marks',
  'marks above the maximum rejected');
select throws_ok(format($$ select public.grade_answer(%L, %L, 2.25) $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')), '22023', 'invalid_marks',
  'only whole or half marks');
select lives_ok(format($$
  select public.grade_answer(%1$L, %4$L, 3.5, 'Mention r x F'), public.grade_answer(%2$L, %4$L, 5),
         public.grade_answer(%3$L, %4$L, 3.5) $$,
  tests.attempt('Unit 1', 'student1@alpha.test'), tests.attempt('Unit 1', 'student2@alpha.test'),
  tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')),
  'teacher marks every written answer (half marks allowed)');
select is((select count(*) from public.audit_events where action = 'attempt_answers.grade'), 0::bigint,
  'teachers do not read audit events');
select lives_ok(format($$ select public.release_results(%L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  'teacher releases Unit 1');

-- Unit 1 hand-computed (max 17): s1 4+4+4+3.5 = 15.5 in 20 min; s3 4+4+4+3.5 = 15.5 in 25 min;
-- s2 −1 (Q1 wrong) + 0 (Q2 blank) + 4 + 5 = 8, auto-submitted at the deadline.
select results_eq(format($$ select tests.email(a.user_id), a.score, a.rank, a.status from public.test_attempts a
     where a.test_id = %L order by a.rank $$, tests.id_of('tests', 'title', 'Unit 1')),
  $$ values ('student1@alpha.test', 15.50, 1, 'submitted'), ('student3@alpha.test', 15.50, 2, 'submitted'),
            ('student2@alpha.test', 8.00, 3, 'auto_submitted') $$,
  'Unit 1 test rank: score, then less time taken');
select is(tests.affected(format($$ update public.tests set title = 'renamed' where id = %L $$,
  tests.id_of('tests', 'title', 'Unit 1'))), 0::bigint, 'a released test cannot be edited directly');

-- ---------------------------------------------------------------- Units 2 and 3 (one 4-mark question each)
select tests.logout();
insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status, created_by)
select tests.inst('alpha'), title, now() - interval '10 hours', now() - interval '9 hours', 3600, 'scheduled',
       tests.uid('teacher1@alpha.test')
from (values ('Unit 2'), ('Unit 3')) v (title);
insert into public.test_questions (test_id, question_id, institute_id, marks, negative_marks)
select id, tests.id_of('questions', 'stem', 'Q1 single'), institute_id, 4, 1 from public.tests where title in ('Unit 2', 'Unit 3');
insert into public.test_audience select t.id, bx.id, t.institute_id from public.tests t, pg_temp.bx
where t.title in ('Unit 2', 'Unit 3');
-- Unit 2: everyone right; s2 and s3 both 10 min (exact tie), s1 20 min. Unit 3: s1 and s3 right, s2 missed it.
insert into public.test_attempts (institute_id, test_id, user_id, membership_id, started_at, deadline_at, submitted_at,
                                  status, question_order)
select tests.inst('alpha'), tests.id_of('tests', 'title', v.title), tests.uid(v.email), tests.mid(v.email),
       now() - interval '10 hours', now() - interval '9 hours', now() - interval '10 hours' + v.took, 'submitted',
       array[tests.id_of('questions', 'stem', 'Q1 single')]
from (values ('Unit 2', 'student1@alpha.test', interval '20 minutes'), ('Unit 2', 'student2@alpha.test', interval '10 minutes'),
             ('Unit 2', 'student3@alpha.test', interval '10 minutes'), ('Unit 3', 'student1@alpha.test', interval '5 minutes'),
             ('Unit 3', 'student3@alpha.test', interval '5 minutes')) v (title, email, took);
insert into public.attempt_answers (attempt_id, question_id, institute_id, response)
select a.id, tests.id_of('questions', 'stem', 'Q1 single'), a.institute_id, '["a"]'
from public.test_attempts a join public.tests t on t.id = a.test_id where t.title in ('Unit 2', 'Unit 3');

select tests.login('teacher1@alpha.test');
select lives_ok(format($$ select public.release_results(%L), public.release_results(%L) $$,
  tests.id_of('tests', 'title', 'Unit 2'), tests.id_of('tests', 'title', 'Unit 3')), 'teacher releases Units 2 and 3');
select results_eq(format($$ select tests.email(a.user_id), a.rank from public.test_attempts a 
    where a.test_id = %L order by a.rank, 1 $$, tests.id_of('tests', 'title', 'Unit 2')),
  $$ values ('student2@alpha.test', 1), ('student3@alpha.test', 1), ('student1@alpha.test', 3) $$,
  'Unit 2: same score and same time = same test rank');

-- ---------------------------------------------------------------- AC7.6 overall rank (hand-computed)
-- s1: (15.5/17·100 + 100 + 100) / 3 = (91.1765 + 200) / 3 = 97.06
-- s3: same marks as s1 → 97.06 → same overall rank
-- s2: (8/17·100 + 100 + 0 missed) / 3 = (47.0588 + 100) / 3 = 49.02, 1 test missed
select results_eq($$ select tests.email(s.user_id), s.average_percentage, s.overall_rank, s.tests_counted, s.tests_missed
    from public.batch_standings s 
    where s.batch_id = (select id from pg_temp.bx) order by s.overall_rank, 1 $$,
  $$ values ('student1@alpha.test', 97.06, 1, 3, 0), ('student3@alpha.test', 97.06, 1, 3, 0),
            ('student2@alpha.test', 49.02, 3, 3, 1) $$,
  'overall rank by average percentage; missed test = 0 %; same average = same rank');

-- Regrade after release: student3's written answer 3.5 → 4. Unit 1: s3 16 → rank 1, s1 → 2.
-- s3 overall = (16/17·100 + 200) / 3 = (94.1176 + 200) / 3 = 98.04 → rank 1; s1 rank 2.
select lives_ok(format($$ select public.grade_answer(%L, %L, 4, 'Re-checked') $$,
  tests.attempt('Unit 1', 'student3@alpha.test'), tests.id_of('questions', 'stem', 'Q4 written')), 'teacher regrades');
select results_eq(format($$ select tests.email(a.user_id), a.score, a.rank from public.test_attempts a
     where a.test_id = %L order by a.rank $$, tests.id_of('tests', 'title', 'Unit 1')),
  $$ values ('student3@alpha.test', 16.00, 1), ('student1@alpha.test', 15.50, 2), ('student2@alpha.test', 8.00, 3) $$,
  'regrade recalculates the test rank');
select results_eq($$ select tests.email(s.user_id), s.average_percentage, s.overall_rank from public.batch_standings s
     where s.batch_id = (select id from pg_temp.bx) order by s.overall_rank $$,
  $$ values ('student3@alpha.test', 98.04, 1), ('student1@alpha.test', 97.06, 2), ('student2@alpha.test', 49.02, 3) $$,
  'regrade recalculates the overall rank');

-- ---------------------------------------------------------------- after release: review and progress (AC7.9)
select tests.login('student1@alpha.test');
select is((select count(*) from public.get_attempt_review(tests.attempt('Unit 1', 'student1@alpha.test'))
           where key is not null), 4::bigint, 'after release the student sees keys and model answers');
select is((select teacher_comment from public.get_attempt_review(tests.attempt('Unit 1', 'student1@alpha.test'))
           where type = 'written'), 'Mention r x F', 'and the teacher''s comment');
select is((select count(*) from public.batch_standings), 1::bigint, 'student sees only own standing row');
create temp table progress_self on commit drop as
  select public.student_progress(tests.inst('alpha'), tests.uid('student1@alpha.test')) as p;
select is((select jsonb_array_length(p -> 'tests') from progress_self), 3, 'progress lists the 3 released tests');
select is((select p -> 'standings' -> 0 ->> 'overall_rank' from progress_self), '2', 'progress shows overall rank');
select is((select p -> 'tests' -> 2 ->> 'written' from progress_self), '3.50', 'progress splits written marks');
select throws_ok(format($$ select public.student_progress(%L, %L) $$, tests.inst('alpha'),
  tests.uid('student2@alpha.test')), '42501', 'not_allowed', 'a student cannot open another student''s progress');

select tests.login('teacher1@alpha.test');
select is(public.student_progress(tests.inst('alpha'), tests.uid('student1@alpha.test')),
  (select p from progress_self), 'teacher sees exactly the numbers the student sees (AC7.9)');
select tests.login('teacher2@alpha.test');
select throws_ok(format($$ select public.student_progress(%L, %L) $$, tests.inst('alpha'),
  tests.uid('student1@alpha.test')), '42501', 'not_allowed', 'a teacher of another batch cannot open it');
select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.student_progress(%L, %L) $$, tests.inst('alpha'),
  tests.uid('student1@alpha.test')), '42501', 'not_allowed', 'another institute''s owner cannot open it');
select throws_ok(format($$ select public.release_results(%L) $$, tests.id_of('tests', 'title', 'Unit 1')),
  '42501', 'not_allowed', 'another institute''s owner cannot release or recalculate');

select tests.logout();
select ok(exists (select 1 from public.audit_events where action = 'tests.release_results'), 'releases are audited');
select ok(exists (select 1 from public.audit_events where action = 'attempt_answers.grade'
                  and metadata ->> 'marks' = '4'), 'regrades are audited');

select * from finish();
rollback;
