-- R1.1 step 5 (ADR-039): staff cannot spend AI on the tutor / Studio and students cannot spend it on notes or
-- questions; AI notes are Markdown documents. (The AI test moved to the test page in R1.2: 220_test_page.sql.)
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

select * from finish();
rollback;
