-- R1.2 item 1 (ADR-042): a test made for one subject is filled on its page with AI-made or typed questions in one
-- transaction; AI questions stay drafts until approved, typed ones are approved; only the test's manager, only a
-- draft, only topics of the test's subject.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select tests.inst('alpha') as inst,
         (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Rotation') as rotation,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Bonding') as bonding,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx;
grant select on ids to authenticated;

create function pg_temp.items(chapter uuid) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('origin', 'ai', 'chapter_id', chapter, 'type', 'single', 'stem', 'AI MCQ',
      'verification', 'dual_solve_agree', 'marks', 4,
      'options', '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]'::jsonb,
      'key', '{"correct":["a"]}'::jsonb, 'second_solve', '{"correct":["a"]}'::jsonb),
    jsonb_build_object('origin', 'ai', 'chapter_id', chapter, 'type', 'written', 'stem', 'AI theory',
      'verification', 'unverified', 'marks', 5, 'key', '{"model_answer":"Torque = r × F"}'::jsonb))
$$;

select tests.login('teacher1@alpha.test');
select lives_ok($$ insert into public.tests (institute_id, subject_id, title, opens_at, closes_at, duration_seconds)
  select inst, physics, 'Physics test page', now() + interval '1 day', now() + interval '1 day 1 hour', 3600 from ids $$,
  'a teacher makes a test for a subject');
select lives_ok($$ insert into public.test_audience (test_id, batch_id, institute_id)
  select t.id, bx, inst from public.tests t, ids where t.title = 'Physics test page' $$, 'for the subject''s batch');
reset role;
create temp table t on commit drop as select id from public.tests where title = 'Physics test page';
grant select on t to authenticated;
select tests.login('teacher1@alpha.test');

select is(public.add_test_questions((select inst from ids), (select id from t), pg_temp.items((select rotation from ids))),
  2, 'AI questions are added');
select is(public.add_test_questions((select inst from ids), (select id from t), jsonb_build_array(jsonb_build_object(
  'origin', 'teacher', 'chapter_id', (select rotation from ids), 'type', 'numerical', 'stem', 'Typed numerical',
  'marks', 2, 'key', '{"value": 9.8, "tolerance_abs": 0.1}'::jsonb))), 1, 'a typed question is added');
select results_eq(
  $$ select q.stem, q.origin, q.status, q.verification, q.chapter_id, tq.position, tq.marks
     from public.test_questions tq join public.questions q on q.id = tq.question_id
     where tq.test_id = (select id from t) order by tq.position $$,
  $$ values ('AI MCQ', 'ai', 'draft', 'dual_solve_agree', (select rotation from ids), 1, 4.0),
            ('AI theory', 'ai', 'draft', 'unverified', (select rotation from ids), 2, 5.0),
            ('Typed numerical', 'teacher', 'approved', 'teacher_verified', (select rotation from ids), 3, 2.0) $$,
  'appended in order: AI drafts, the typed one approved; all in the bank under their topic');
select is((select second_solve from public.question_keys k join public.questions q on q.id = k.question_id
  where q.stem = 'AI MCQ'), '{"correct":["a"]}'::jsonb, 'the blind second answer is stored');
select throws_ok($$ update public.tests set status = 'scheduled' where id = (select id from t) $$,
  'P0001', null, 'it cannot be scheduled before its AI questions are approved');
select throws_ok($$ update public.questions set status = 'approved' where stem = 'AI theory' $$,
  'P0001', 'question_not_verified', 'an AI theory question needs a teacher''s check first');

select throws_ok($$ select public.add_test_questions(inst, (select id from t), pg_temp.items(bonding)) from ids $$,
  '23514', 'invalid_items', 'a topic of another subject is refused');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), jsonb_build_array(jsonb_build_object(
  'chapter_id', rotation, 'type', 'single', 'stem', 'No origin', 'key', '{"correct":["a"]}'::jsonb))) from ids $$,
  '23514', 'invalid_items', 'an item needs an origin');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), jsonb_build_array(jsonb_build_object(
  'origin', 'ai', 'chapter_id', rotation, 'type', 'single', 'stem', 'Bad key', 'verification', 'unverified',
  'options', '[]'::jsonb, 'key', '{"correct":["z"]}'::jsonb))) from ids $$,
  '23514', null, 'an invalid question fails the whole call');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), '[]') from ids $$,
  '23514', 'invalid_items', 'at least one item');
select is((select count(*)::int from public.test_questions where test_id = (select id from t)), 3,
  'nothing of a failed call is stored');
select is((select count(*)::int from public.questions where stem in ('Bad key', 'No origin')), 0,
  'not even in the bank');

-- Founder (migration 25): typed questions carry their own negative marks; a theory question's model answer is optional.
select is(public.add_test_questions((select inst from ids), (select id from t), jsonb_build_array(
  jsonb_build_object('origin', 'teacher', 'chapter_id', (select rotation from ids), 'type', 'single',
    'stem', 'Typed MCQ', 'marks', 4, 'negative_marks', 1,
    'options', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]'::jsonb, 'key', '{"correct":["b"]}'::jsonb),
  jsonb_build_object('origin', 'teacher', 'chapter_id', (select rotation from ids), 'type', 'written',
    'stem', 'Typed theory', 'marks', 5, 'key', '{"model_answer":""}'::jsonb))), 2,
  'a typed MCQ with negative marks and a theory question without a model answer are added');
select results_eq(
  $$ select q.stem, tq.marks, tq.negative_marks from public.test_questions tq
     join public.questions q on q.id = tq.question_id
     where tq.test_id = (select id from t) and q.stem like 'Typed %' order by tq.position $$,
  $$ values ('Typed numerical', 2.0, 0.0), ('Typed MCQ', 4.0, 1.0), ('Typed theory', 5.0, 0.0) $$,
  'negative marks are stored per question (default 0)');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), jsonb_build_array(jsonb_build_object(
  'origin', 'teacher', 'chapter_id', rotation, 'type', 'numerical', 'stem', 'Too negative', 'marks', 2,
  'negative_marks', 3, 'key', '{"value": 1}'::jsonb))) from ids $$,
  '23514', null, 'negative marks above the question''s marks are refused');

-- A test without a subject (made before R1.2) and a scheduled test take no questions this way.
select lives_ok($$ insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds)
  select inst, 'Old test', now() + interval '1 day', now() + interval '1 day 1 hour', 3600 from ids $$, 'an old-style test');
select throws_ok($$ select public.add_test_questions(inst, (select id from public.tests where title = 'Old test'),
  pg_temp.items(rotation)) from ids $$, '42501', null, 'a test without a subject is refused');
reset role;
update public.tests set status = 'cancelled' where title = 'Old test';
update public.tests set subject_id = (select physics from ids) where title = 'Old test';
select tests.login('teacher1@alpha.test');
select throws_ok($$ select public.add_test_questions(inst, (select id from public.tests where title = 'Old test'),
  pg_temp.items(rotation)) from ids $$, '42501', null, 'a test that is no longer a draft is refused');

-- Who may add.
select tests.login('owner@alpha.test');
select is(public.add_test_questions((select inst from ids), (select id from t), pg_temp.items((select rotation from ids))),
  2, 'the owner may add to a teacher''s test');
select tests.login('teacher2@alpha.test');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), pg_temp.items(rotation)) from ids $$,
  '42501', null, 'another teacher cannot add to it');
select tests.login('student1@alpha.test');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), pg_temp.items(rotation)) from ids $$,
  '42501', null, 'students cannot');
select tests.login('owner@bravo.test');
select throws_ok($$ select public.add_test_questions(inst, (select id from t), pg_temp.items(rotation)) from ids $$,
  '42501', null, 'another institute cannot');
select throws_ok($$ select public.add_test_questions(tests.inst('bravo'), (select id from t), pg_temp.items(rotation))
  from ids $$, '42501', null, 'not even with its own institute id');

select * from finish();
rollback;
