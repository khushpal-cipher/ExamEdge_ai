-- R1.1 step 6 (ADR-040): progress for one batch ("my own time"), past batch skips tests held after leaving.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y') as by_,
         (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics;
grant select on ids to authenticated;

-- student1: in Batch X from 23 h ago until 22 h ago (promoted), now in Batch Y.
update public.batch_members set created_at = now() - interval '23 hours' where batch_id = (select bx from ids);
update public.batch_members set left_at = now() - interval '22 hours'
where membership_id = tests.mid('student1@alpha.test');
insert into public.batch_members values ((select by_ from ids), tests.mid('student1@alpha.test'), tests.inst('alpha'), 'student');

insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status, results_release_at)
values (tests.inst('alpha'), 'Before leaving', now() - interval '22 hours 50 minutes', now() - interval '22 hours 10 minutes',
        1800, 'results_released', now() - interval '22 hours 10 minutes'),
       (tests.inst('alpha'), 'After leaving', now() - interval '21 hours', now() - interval '20 hours', 3600,
        'results_released', now() - interval '20 hours');
insert into public.test_questions (test_id, question_id, institute_id)
select t.id, q.id, q.institute_id from public.tests t, public.questions q
where t.title in ('Before leaving', 'After leaving') and q.institute_id = tests.inst('alpha');
insert into public.test_audience
select id, (select bx from ids), institute_id from public.tests where title in ('Before leaving', 'After leaving');

-- One doubt on Batch X's Physics.
insert into public.conversations (institute_id, user_id, subject_id, title)
values (tests.inst('alpha'), tests.uid('student1@alpha.test'), (select physics from ids), 'Old doubt');
insert into public.messages (institute_id, conversation_id, role, content)
select institute_id, id, 'user', 'Why?' from public.conversations where title = 'Old doubt';

select tests.login('student1@alpha.test');
select is((select jsonb_agg(t ->> 'title') from jsonb_array_elements(
    public.student_progress(tests.inst('alpha'), tests.uid('student1@alpha.test'), (select bx from ids)) -> 'tests') t),
  '["Before leaving"]'::jsonb, 'past batch: the test held while in it, not the one held after leaving');
select is(jsonb_array_length(public.student_progress(tests.inst('alpha'), tests.uid('student1@alpha.test')) -> 'tests'), 1,
  'all batches: the test after leaving is not listed as missed either');
select is(public.student_progress(tests.inst('alpha'), tests.uid('student1@alpha.test'), (select by_ from ids)) -> 'tests',
  '[]'::jsonb, 'current batch: none of the old batch''s tests');
select is(jsonb_array_length(public.tutor_activity(tests.inst('alpha'), tests.uid('student1@alpha.test'), (select bx from ids))),
  1, 'doubts of the past batch''s subjects');
select is(public.tutor_activity(tests.inst('alpha'), tests.uid('student1@alpha.test'), (select by_ from ids)), '[]'::jsonb,
  'none in the current batch');
select is(public.practice_activity(tests.inst('alpha'), tests.uid('student1@alpha.test'), (select by_ from ids)), '[]'::jsonb,
  'practice filtered by batch too');

select tests.login('student3@alpha.test');
select throws_ok(format($$ select public.student_progress(%L, %L, %L) $$, tests.inst('alpha'),
  tests.uid('student1@alpha.test'), (select by_ from ids)), '42501', 'not_allowed',
  'a classmate cannot open it with a batch either');
select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.tutor_activity(%L, %L, %L) $$, tests.inst('alpha'),
  tests.uid('student1@alpha.test'), (select bx from ids)), '42501', 'not_allowed', 'nor another institute''s owner');

select * from finish();
rollback;
