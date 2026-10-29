-- Batch C2: whole-batch Performance numbers are readable by owner/admin and the batch's teacher only.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y') as by_;
grant select on ids to authenticated;
insert into public.batch_standings (batch_id, user_id, institute_id, average_percentage, tests_counted, overall_rank)
values ((select bx from ids), tests.uid('student1@alpha.test'), tests.inst('alpha'), 50, 1, 1);

select tests.login('owner@alpha.test');
select is((public.batch_performance(tests.inst('alpha'), (select bx from ids)) ->> 'students')::int, 2,
  'owner: Batch X has two students');
select ok(jsonb_typeof(public.batch_performance(tests.inst('alpha'), (select bx from ids)) -> 'people') = 'array',
  'owner: people list present');

select tests.login('teacher1@alpha.test');
select is((public.batch_performance(tests.inst('alpha'), (select bx from ids)) ->> 'students')::int, 2,
  'teacher of the batch can read it');
select throws_ok(format($$ select public.batch_performance(%L, %L) $$, tests.inst('alpha'), (select by_ from ids)),
  '42501', 'not_allowed', 'teacher of another batch cannot');

select tests.login('student1@alpha.test');
select throws_ok(format($$ select public.batch_performance(%L, %L) $$, tests.inst('alpha'), (select bx from ids)),
  '42501', 'not_allowed', 'a student cannot');

select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.batch_performance(%L, %L) $$, tests.inst('alpha'), (select bx from ids)),
  '42501', 'not_allowed', 'another institute''s owner cannot');
select throws_ok(format($$ select public.batch_performance(%L, %L) $$, tests.inst('bravo'), (select bx from ids)),
  '42501', 'not_allowed', 'nor with their own institute id and our batch');

-- Rank list for students: with names, own row marked, outsiders refused.
select tests.login('student1@alpha.test');
select ok(public.batch_rank_list((select bx from ids)) is not null, 'student: rank list readable');
select ok((select bool_and(r ? 'name') from jsonb_array_elements(public.batch_rank_list((select bx from ids))) r),
  'rank list carries names');
select throws_ok(format($$ select public.batch_rank_list(%L) $$, (select by_ from ids)), '42501', 'not_allowed',
  'student of Batch X cannot read Batch Y ranks');
select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.batch_rank_list(%L) $$, (select bx from ids)), '42501', 'not_allowed',
  'another institute cannot');

select * from finish();
rollback;
