-- AI-made bank questions (AC7.5, ADR-032): stored as drafts in one transaction, a draft whose second answer differs
-- (or is missing) cannot be approved until a teacher verifies it, nobody can mark a question as AI-checked by hand,
-- and only staff may store them or reserve AI for them.
begin;
select tests.setup();
select * from no_plan();

create temp table fx on commit drop as
  select tests.inst('alpha') as inst,
         (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics;
grant select on fx to authenticated;

create function pg_temp.item(stem text, verification text, key jsonb, type text default 'single') returns jsonb
language sql as $$
  select jsonb_build_object('type', type, 'stem', stem, 'difficulty', 'hard', 'verification', verification,
    'explanation', 'why', 'key', key,
    'options', case when type = 'numerical' then '[]'::jsonb else
      '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]'::jsonb end,
    'second_solve', case verification when 'unverified' then null
      when 'dual_solve_agree' then key else '{"correct":["b"]}'::jsonb end)
$$;
create function pg_temp.q(stem text) returns uuid language sql as $$ select tests.id_of('questions', 'stem', stem) $$;

-- ---------------------------------------------------------------- storing a generation
select tests.login('teacher1@alpha.test');
select is(public.add_ai_questions((select inst from fx), (select physics from fx), null, jsonb_build_array(
    pg_temp.item('Q agree', 'dual_solve_agree', '{"correct":["a"]}'),
    pg_temp.item('Q differ', 'dual_solve_disagree', '{"correct":["a"]}'),
    pg_temp.item('Q unchecked', 'unverified', '{"value":9.8,"tolerance_abs":0.1}', 'numerical'))),
  3, 'a teacher stores three generated questions');
select results_eq(
  $$ select q.stem, q.origin, q.status, q.verification, q.difficulty, k.key, k.second_solve
     from public.questions q join public.question_keys k on k.question_id = q.id
     where q.stem like 'Q %' order by q.stem $$,
  $$ values ('Q agree', 'ai', 'draft', 'dual_solve_agree', 'hard', '{"correct":["a"]}'::jsonb, '{"correct":["a"]}'::jsonb),
            ('Q differ', 'ai', 'draft', 'dual_solve_disagree', 'hard', '{"correct":["a"]}', '{"correct":["b"]}'),
            ('Q unchecked', 'ai', 'draft', 'unverified', 'hard', '{"value":9.8,"tolerance_abs":0.1}', null) $$,
  'stored as AI drafts with their key and second answer');

select throws_ok(
  $$ select public.add_ai_questions((select inst from fx), (select physics from fx), null, jsonb_build_array(
       pg_temp.item('Q ok', 'dual_solve_agree', '{"correct":["a"]}'),
       pg_temp.item('Q bad key', 'dual_solve_agree', '{"correct":["a","b"]}'))) $$,
  '23514', 'invalid_key', 'an invalid key fails the whole generation');
select is((select count(*)::int from public.questions where stem in ('Q ok', 'Q bad key')), 0,
  'nothing of a failed generation is stored');

select throws_ok(
  $$ select public.add_ai_questions((select inst from fx), (select physics from fx), null,
       jsonb_build_array(pg_temp.item('Q forged', 'teacher_verified', '{"correct":["a"]}'))) $$,
  '23514', 'invalid_verification', 'an AI question cannot be stored as already teacher-verified');

insert into public.questions (institute_id, subject_id, type, stem, origin, verification, status)
  values ((select inst from fx), (select physics from fx), 'written', 'Q direct', 'ai', 'dual_solve_agree', 'approved');
select is((select status from public.questions where stem = 'Q direct'), 'draft',
  'an AI question inserted directly as approved is stored as a draft');

-- ---------------------------------------------------------------- approval
select lives_ok($$ update public.questions set status = 'approved' where id = pg_temp.q('Q agree') $$,
  'a draft whose answers matched can be approved');
select throws_ok($$ update public.questions set status = 'approved' where id = pg_temp.q('Q differ') $$,
  'P0001', 'question_not_verified', 'a draft whose answers differ cannot be approved');
select throws_ok($$ update public.questions set status = 'approved' where id = pg_temp.q('Q unchecked') $$,
  'P0001', 'question_not_verified', 'a draft without a second answer cannot be approved');
select throws_ok($$ update public.questions set verification = 'dual_solve_agree' where id = pg_temp.q('Q differ') $$,
  '23514', 'invalid_verification', 'nobody can mark a question as AI-checked by hand');
select lives_ok(
  $$ update public.questions set status = 'approved', verification = 'teacher_verified' where id = pg_temp.q('Q differ') $$,
  'after a teacher checks it (verification = teacher_verified) it can be approved');
select is((select status from public.questions where stem = 'Q differ'), 'approved', 'the checked question is approved');

-- Teacher-typed questions are unaffected (default teacher_verified + approved).
insert into public.questions (institute_id, subject_id, type, stem)
  values ((select inst from fx), (select physics from fx), 'written', 'Q typed');
select is((select (status, origin, verification)::text from public.questions where stem = 'Q typed'),
  '(approved,teacher,teacher_verified)', 'a teacher-typed question is approved as before');

-- ---------------------------------------------------------------- who may do it
select tests.login('student1@alpha.test');
select throws_ok(
  $$ select public.add_ai_questions((select inst from fx), (select physics from fx), null,
       jsonb_build_array(pg_temp.item('Q student', 'dual_solve_agree', '{"correct":["a"]}'))) $$,
  '42501', null, 'a student cannot store bank questions');
select is((select count(*)::int from public.question_keys), 0, 'a student reads no keys or second answers');
select throws_ok($$ select * from public.ai_reserve((select inst from fx), 'question_gen', 'fake', 'fake', 10) $$,
  '42501', 'not_allowed', 'a student cannot reserve AI for bank questions');

select tests.login('teacher1@bravo.test');
select throws_ok(
  $$ select public.add_ai_questions((select inst from fx), (select physics from fx), null,
       jsonb_build_array(pg_temp.item('Q other', 'dual_solve_agree', '{"correct":["a"]}'))) $$,
  '42501', null, 'staff of another institute cannot store questions here');
select throws_ok($$ select * from public.ai_reserve((select inst from fx), 'question_gen', 'fake', 'fake', 10) $$,
  '42501', 'not_allowed', 'staff of another institute cannot reserve AI here');

select tests.login('teacher1@alpha.test');
select is((select blocked from public.ai_reserve((select inst from fx), 'question_gen', 'fake', 'fake', 10)), null,
  'a teacher can reserve AI for bank questions');
select throws_ok($$ select * from public.ai_reserve((select inst from fx), 'question_gen', 'fake', 'fake', 1000001) $$,
  '22023', 'reserve_out_of_range', 'one call reserves at most 1 USD');

select * from finish();
rollback;
