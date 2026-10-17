-- R1.1 (ADR-038, ADR-040): subjects inside batches, Topic → Subtopic, notes only in a subtopic, past batch members.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
         (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Chemistry') as chem,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Rotation') as rotation,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Bonding') as bonding,
         (select id from public.subtopics where institute_id = tests.inst('alpha') and name = 'Torque') as torque,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y') as by_;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- subjects belong to one batch
select throws_ok(format($$ insert into public.subjects (institute_id, name) values (%L, 'Maths') $$, tests.inst('alpha')),
  '23502', null, 'a subject needs a batch');
select lives_ok(format($$ insert into public.subjects (institute_id, batch_id, name) values (%L, %L, 'Physics') $$,
  tests.inst('alpha'), (select by_ from ids)), 'two batches may each have a subject called Physics');
select throws_ok(format($$ insert into public.subjects (institute_id, batch_id, name) values (%L, %L, 'Physics') $$,
  tests.inst('alpha'), (select bx from ids)), '23505', null, 'names are unique inside a batch');
select throws_ok(format($$ insert into public.subjects (institute_id, batch_id, name) values (%L, %L, 'Maths') $$,
  tests.inst('alpha'), (select id from public.batches where institute_id = tests.inst('bravo') and name = 'Batch X')),
  '23503', null, 'a subject cannot sit in another institute''s batch');

select tests.login('student1@alpha.test');
select is((select array_agg(name) from public.subjects), array['Physics'], 'student1 sees only Batch X''s subject');
select is((select array_agg(name) from public.subtopics), array['Torque'], 'and its subtopics');
select throws_ok(format($$ insert into public.subtopics (institute_id, subject_id, chapter_id, name)
  values (%L, %L, %L, 'Mine') $$, tests.inst('alpha'), (select physics from ids), (select rotation from ids)),
  '42501', null, 'students cannot add subtopics');
select tests.login('student3@alpha.test');
select is((select count(*) from public.subtopics), 0::bigint, 'Batch Y''s student sees no Physics subtopic');

-- ---------------------------------------------------------------- subtopics and notes
select tests.login('teacher1@alpha.test');
select lives_ok(format($$ insert into public.subtopics (institute_id, subject_id, chapter_id, name)
  values (%L, %L, %L, 'Angular momentum') $$, tests.inst('alpha'), (select physics from ids), (select rotation from ids)),
  'a teacher adds a subtopic');
select throws_ok(format($$ insert into public.subtopics (institute_id, subject_id, chapter_id, name)
  values (%L, %L, %L, 'Wrong') $$, tests.inst('alpha'), (select physics from ids), (select bonding from ids)),
  '23503', null, 'a subtopic''s topic must belong to its subject');
select throws_ok(format($$ insert into public.documents (institute_id, subject_id, title) values (%L, %L, 'Loose') $$,
  tests.inst('alpha'), (select physics from ids)), '23502', null, 'notes need a topic and subtopic');
select throws_ok(format($$ insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title)
  values (%L, %L, %L, %L, 'Mixed') $$, tests.inst('alpha'), (select chem from ids), (select rotation from ids),
  (select torque from ids)), '23503', null, 'a document''s topic must belong to its subject');
select tests.logout();
select throws_ok(format($$ delete from public.chapters where id = %L $$, (select rotation from ids)), '23503', null,
  'a topic that still has notes cannot be deleted');
select throws_ok(format($$ delete from public.subtopics where id = %L $$, (select torque from ids)), '23503', null,
  'a subtopic that still has notes cannot be deleted');

-- ---------------------------------------------------------------- batch history
select tests.login('teacher1@alpha.test');
select is(tests.affected(format($$ update public.batch_members set left_at = now() where membership_id = %L $$,
  tests.mid('student1@alpha.test'))), 0::bigint, 'a teacher cannot move a student out of a batch');
select tests.login('student1@alpha.test');
select is(tests.affected(format($$ update public.batch_members set left_at = null where membership_id = %L $$,
  tests.mid('student1@alpha.test'))), 0::bigint, 'a student cannot change their own batch history');

-- An open test in Batch X; student2 starts it before leaving, student1 has not started when they leave.
select tests.logout();
insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status)
values (tests.inst('alpha'), 'Open now', now() - interval '1 hour', now() + interval '1 hour', 3600, 'scheduled');
insert into public.test_questions (test_id, question_id, institute_id)
select tests.id_of('tests', 'title', 'Open now'), id, institute_id from public.questions
where institute_id = tests.inst('alpha');
insert into public.test_audience values (tests.id_of('tests', 'title', 'Open now'), (select bx from ids), tests.inst('alpha'));
select tests.login('student2@alpha.test');
select isnt(public.start_attempt(tests.id_of('tests', 'title', 'Open now')), null, 'student2 starts the open test');

select tests.login('owner@alpha.test');
select is(tests.affected(format($$ update public.batch_members set left_at = now()
  where batch_id = %L and membership_id in (%L, %L) $$, (select bx from ids), tests.mid('student1@alpha.test'),
  tests.mid('student2@alpha.test'))), 2::bigint, 'the owner moves both students out of Batch X');

select tests.login('student1@alpha.test');
select is((select array_agg(name) from public.subjects), array['Physics'], 'a past batch''s subject stays readable');
select is((select count(*) from public.documents), 1::bigint, 'and its published notes');
select throws_ok(format($$ select public.start_attempt(%L) $$, tests.id_of('tests', 'title', 'Open now')), 'P0001',
  'not_current_member', 'a past member cannot start a new test');
select tests.login('student2@alpha.test');
select is(public.start_attempt(tests.id_of('tests', 'title', 'Open now')), tests.attempt('Open now', 'student2@alpha.test'),
  'an attempt started before leaving can still be resumed');

-- Overall rank: a test that opened after the student left is neither taken nor missed by them (the fixture's own
-- test closed before anyone joined).
select tests.logout();
update public.batch_members set created_at = now() - interval '23 hours' where batch_id = (select bx from ids);
update public.batch_members set left_at = now() - interval '22 hours'
where membership_id = tests.mid('student1@alpha.test');
update public.batch_members set left_at = null where membership_id = tests.mid('student2@alpha.test');
insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status, results_release_at)
values (tests.inst('alpha'), 'After leaving', now() - interval '21 hours', now() - interval '20 hours', 3600,
        'results_released', now() - interval '20 hours');
insert into public.test_questions (test_id, question_id, institute_id)
select tests.id_of('tests', 'title', 'After leaving'), id, institute_id from public.questions
where institute_id = tests.inst('alpha');
insert into public.test_audience
values (tests.id_of('tests', 'title', 'After leaving'), (select bx from ids), tests.inst('alpha'));
select private.compute_standings((select bx from ids));
select is((select tests_missed from public.batch_standings where user_id = tests.uid('student1@alpha.test')), 0,
  'the past member does not miss a test held after they left');
select is((select tests_missed from public.batch_standings where user_id = tests.uid('student2@alpha.test')), 1,
  'the current member missed it');

select * from finish();
rollback;
