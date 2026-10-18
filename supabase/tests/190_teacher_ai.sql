-- R1.1 step 5 (ADR-039): staff cannot spend AI on the tutor / Studio and students cannot spend it on notes or
-- questions; AI notes are Markdown documents; an AI test is stored as a draft test for the subject's own batch in one
-- transaction and cannot be scheduled before its questions are approved.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select tests.inst('alpha') as inst,
         (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Rotation') as rotation,
         (select id from public.subtopics where institute_id = tests.inst('alpha') and name = 'Torque') as torque,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx;
grant select on ids to authenticated;

select is((select allowed_mime_types from storage.buckets where id = 'documents'),
  '{application/pdf,image/png,image/jpeg,text/markdown}', 'the notes bucket accepts Markdown');

-- ---------------------------------------------------------------- who may reserve which feature
select tests.login('teacher1@alpha.test');
select is((select blocked from public.ai_reserve((select inst from ids), 'notes_gen', 'fake', 'fake', 1)), null,
  'a teacher reserves AI notes');
select is((select blocked from public.ai_reserve((select inst from ids), 'question_gen', 'fake', 'fake', 1)), null,
  'a teacher reserves AI questions');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'tutor', 'fake', 'fake', 1) $$,
  '42501', null, 'a teacher cannot use the tutor');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'tutor_premium', 'fake', 'fake', 1) $$,
  '42501', null, 'nor the step-by-step tutor');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'generation', 'fake', 'fake', 1) $$,
  '42501', null, 'nor Studio');
select tests.login('owner@alpha.test');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'generation', 'fake', 'fake', 1) $$,
  '42501', null, 'the owner cannot use Studio either');
select tests.login('student1@alpha.test');
select is((select blocked from public.ai_reserve((select inst from ids), 'generation', 'fake', 'fake', 1)), null,
  'a student uses Studio');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'notes_gen', 'fake', 'fake', 1) $$,
  '42501', null, 'a student cannot spend AI on notes');
select tests.login('teacher1@bravo.test');
select throws_ok($$ select * from public.ai_reserve((select inst from ids), 'notes_gen', 'fake', 'fake', 1) $$,
  '42501', null, 'another institute''s teacher cannot reserve here');

-- ---------------------------------------------------------------- AI notes are Markdown documents
select tests.login('teacher1@alpha.test');
select lives_ok($$ insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title, kind)
  select inst, physics, rotation, torque, 'AI notes: Torque', 'ai_notes' from ids $$, 'a teacher saves AI notes');
select lives_ok(format($$ insert into public.document_versions (id, institute_id, document_id, version, storage_path,
    mime, size_bytes) select %2$L, %1$L, d.id, 1, %1$L || '/' || d.id || '/' || %2$L, 'text/markdown', 100
  from public.documents d where d.title = 'AI notes: Torque' $$, (select inst from ids), gen_random_uuid()),
  'their file is a Markdown version');
select throws_ok($$ insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title, kind)
  select inst, physics, rotation, torque, 'x', 'video' from ids $$, '23514', null, 'only known document kinds');
select tests.login('student1@alpha.test');
select throws_ok($$ insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title, kind)
  select inst, physics, rotation, torque, 'mine', 'ai_notes' from ids $$, '42501', null, 'students cannot save notes');

-- ---------------------------------------------------------------- AI test
create function pg_temp.items() returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('type', 'single', 'stem', 'AI MCQ', 'verification', 'dual_solve_agree', 'marks', 4,
      'options', '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"},{"id":"d","text":"D"}]'::jsonb,
      'key', '{"correct":["a"]}'::jsonb, 'second_solve', '{"correct":["a"]}'::jsonb),
    jsonb_build_object('type', 'written', 'stem', 'AI theory', 'verification', 'unverified', 'marks', 5,
      'key', '{"model_answer":"Torque = r × F"}'::jsonb))
$$;
select tests.login('teacher1@alpha.test');
select isnt(public.add_ai_test((select inst from ids), (select physics from ids), (select rotation from ids),
  'Rotation AI test', now() + interval '1 day', now() + interval '1 day 1 hour', 3600, pg_temp.items()), null,
  'a teacher makes an AI test');
select results_eq(
  $$ select t.status, a.batch_id, q.stem, q.status, q.verification, tq.position, tq.marks
     from public.tests t join public.test_audience a on a.test_id = t.id
     join public.test_questions tq on tq.test_id = t.id join public.questions q on q.id = tq.question_id
     where t.title = 'Rotation AI test' order by tq.position $$,
  $$ values ('draft', (select bx from ids), 'AI MCQ', 'draft', 'dual_solve_agree', 1, 4.0),
            ('draft', (select bx from ids), 'AI theory', 'draft', 'unverified', 2, 5.0) $$,
  'a draft test for the subject''s batch, its questions in order as AI drafts');
select throws_ok($$ update public.tests set status = 'scheduled' where title = 'Rotation AI test' $$,
  'P0001', null, 'it cannot be scheduled before its questions are approved');
select throws_ok($$ update public.questions set status = 'approved' where stem = 'AI theory' $$,
  'P0001', 'question_not_verified', 'an AI theory question needs a teacher''s check first');
select throws_ok($$ select public.add_ai_test(inst, physics, rotation, 'Bad', now() + interval '1 day',
  now() + interval '1 day 1 hour', 3600, jsonb_build_array(jsonb_build_object('type', 'single', 'stem', 'Bad key',
  'verification', 'unverified', 'options', '[]'::jsonb, 'key', '{"correct":["z"]}'::jsonb))) from ids $$,
  '23514', null, 'an invalid question fails the whole test');
select is((select count(*)::int from public.tests where title = 'Bad'), 0, 'nothing of a failed AI test is stored');

select tests.login('teacher2@alpha.test');
select throws_ok($$ select public.add_ai_test(inst, physics, rotation, 'Other batch', now() + interval '1 day',
  now() + interval '1 day 1 hour', 3600, pg_temp.items()) from ids $$,
  '42501', null, 'a teacher of another batch cannot make a test for this one');
select tests.login('student1@alpha.test');
select throws_ok($$ select public.add_ai_test(inst, physics, rotation, 'Student', now() + interval '1 day',
  now() + interval '1 day 1 hour', 3600, pg_temp.items()) from ids $$, '42501', null, 'students cannot');
select tests.login('owner@bravo.test');
select throws_ok($$ select public.add_ai_test(inst, physics, rotation, 'Rival', now() + interval '1 day',
  now() + interval '1 day 1 hour', 3600, pg_temp.items()) from ids $$,
  '42501', null, 'another institute cannot (the subject is invisible)');

select * from finish();
rollback;
