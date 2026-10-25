-- Phase 9: Studio artifacts and practice quizzes (ADR-028). AC9.4 / T-ISO-01: a student's artifacts and practice
-- tries are private to that student; institute artifacts reach students only once published to their batch.
begin;
select tests.setup();
select plan(48);

create temp table ids as select
  tests.inst('alpha') as a,
  (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
  (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Chemistry') as chemistry,
  (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Rotation') as rotation,
  (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Bonding') as bonding,
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx,
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y') as by_,
  (select id from public.generated_artifacts where institute_id = tests.inst('alpha') and kind = 'quiz') as quiz,
  (select id from public.generated_artifacts where institute_id = tests.inst('alpha') and owner_scope = 'student')
    as own;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- who reads what
select tests.login('student1@alpha.test');
select is((select count(*) from public.generated_artifacts), 2::bigint,
  'student1 reads their own flashcards and the quiz published to their batch');
select is((select count(*) from public.practice_attempts), 1::bigint, 'student1 reads their own practice try');

select tests.login('student2@alpha.test');
select results_eq($$ select id from public.generated_artifacts $$, $$ select quiz from ids $$,
  'a classmate reads the published quiz but not student1''s flashcards');
select is((select count(*) from public.practice_attempts), 0::bigint, 'a classmate reads no practice try');
select is(tests.affected($$ update public.generated_artifacts set content = '{}' where id = (select own from ids) $$),
  0::bigint, 'a classmate cannot edit student1''s artifact');
select is(tests.affected($$ delete from public.generated_artifacts where id = (select own from ids) $$),
  0::bigint, 'a classmate cannot delete student1''s artifact');

select tests.login('student3@alpha.test');
select is((select count(*) from public.generated_artifacts), 0::bigint, 'a student of another batch reads nothing');

select tests.login('teacher1@alpha.test');
select results_eq($$ select id from public.generated_artifacts $$, $$ select quiz from ids $$,
  'staff read institute artifacts, never a student''s own');
select is((select count(*) from public.practice_attempts), 0::bigint, 'staff read no practice try directly');
select tests.login('owner@alpha.test');
select is((select count(*) from public.generated_artifacts where owner_scope = 'student'), 0::bigint,
  'the owner reads no student artifact');

-- ---------------------------------------------------------------- a student's own artifacts
select tests.login('student1@alpha.test');
select lives_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'summary', physics, rotation, repeat('c', 64), 'studio-v1', 'fake', '{"sections":[]}' from ids $$,
  'student1 saves an artifact of their own');
-- ADR-050: audio and video overviews are artifacts too; other kinds stay refused.
select lives_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'audio_overview', physics, rotation, repeat('e', 64), 'studio-v2', 'fake', '{"parts":[]}' from ids $$,
  'student1 saves an audio overview');
select lives_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'video_overview', physics, rotation, repeat('f', 64), 'studio-v2', 'fake', '{"slides":[]}' from ids $$,
  'student1 saves a video overview');
select throws_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'podcast', physics, rotation, repeat('9', 64), 'studio-v2', 'fake', '{}' from ids $$,
  '23514', null, 'an unknown kind is refused');
select results_eq($$ select owner_user_id, status from public.generated_artifacts where input_hash = repeat('c', 64) $$,
  $$ values (auth.uid(), 'draft') $$, 'it belongs to the caller and is never shared');
select throws_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'institute', 'summary', physics, rotation, repeat('d', 64), 'studio-v1', 'fake', '{}' from ids $$,
  '42501', null, 'a student cannot make an institute artifact');
select throws_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'summary', chemistry, bonding, repeat('d', 64), 'studio-v1', 'fake', '{}' from ids $$,
  '42501', null, 'no artifact on a subject outside the student''s batches');
select throws_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'summary', physics, bonding, repeat('d', 64), 'studio-v1', 'fake', '{}' from ids $$,
  '23503', null, 'the chapter must belong to the subject');
select lives_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'student', 'summary', physics, rotation, repeat('c', 64), 'studio-v1', 'fake', '{}' from ids $$,
  'a student may make the same request again (ADR-054)');
select is(tests.affected($$ update public.generated_artifacts set content = '{}' where id = (select own from ids) $$),
  0::bigint, 'a student artifact is not edited in place');
select is(tests.affected($$ delete from public.generated_artifacts where id = (select own from ids) $$),
  1::bigint, 'student1 deletes their own artifact');

-- ---------------------------------------------------------------- practice quizzes are graded by the database
select tests.login('student2@alpha.test');
-- Code review 9: the answers are not readable before the first try, neither as content nor as a column.
select throws_ok($$ select content from public.generated_artifacts $$, '42501', null,
  'the content column is closed to API users');
select is((select jsonb_path_exists(public.artifact_content((select quiz from ids)), '$.questions[*].answer')), false,
  'before a try the quiz comes without answers');
select is((select jsonb_path_exists(public.artifact_content((select quiz from ids)), '$.questions[*].explanation')),
  false, 'and without explanations');
select is((select jsonb_array_length(public.artifact_content((select quiz from ids)) -> 'questions')), 2,
  'but with all its questions');
select is(public.submit_practice((select quiz from ids), '{"q1":"a","q2":"c","x":"junk"}') - 'results',
  '{"score":1,"max_score":2}'::jsonb, 'the database grades the quiz');
select results_eq($$ select answers, score, max_score from public.practice_attempts $$,
  $$ values ('{"q1":"a","q2":"c"}'::jsonb, 1, 2) $$, 'the try is recorded for the student, unknown answers dropped');
select throws_ok($$ insert into public.practice_attempts (institute_id, user_id, artifact_id, answers, score, max_score)
  select a, auth.uid(), quiz, '{}', 2, 2 from ids $$, '42501', null, 'a student cannot write a score directly');
select is((select jsonb_path_exists(public.artifact_content((select quiz from ids)), '$.questions[*].answer')), true,
  'after a try the answers come with the content');
select tests.login('student3@alpha.test');
select throws_ok($$ select public.artifact_content((select quiz from ids)) $$, '42501', 'not_allowed',
  'a student outside the audience cannot read the content');
select throws_ok($$ select public.submit_practice((select quiz from ids), '{}') $$, '42501', 'not_allowed',
  'a quiz not published to the student''s batch cannot be taken');
select tests.login('student1@bravo.test');
select throws_ok($$ select public.submit_practice((select quiz from ids), '{}') $$, '42501', 'not_allowed',
  'another institute''s student cannot take it');
select tests.login('teacher1@alpha.test');
select is((select jsonb_path_exists(public.artifact_content((select quiz from ids)), '$.questions[*].answer')), true,
  'staff read the quiz with its answers');
select throws_ok($$ select public.submit_practice((select quiz from ids), '{}') $$, '42501', 'not_allowed',
  'staff tries are not recorded');

-- ---------------------------------------------------------------- practice on the progress page (counts only)
select is(public.practice_activity((select a from ids), tests.uid('student1@alpha.test')) -> 0,
  '{"subject":"Physics","chapter":"Rotation","quizzes":1,"average":50.00}'::jsonb
    || jsonb_build_object('last_at', public.practice_activity((select a from ids), tests.uid('student1@alpha.test')) -> 0 -> 'last_at'),
  'the teacher of the batch sees practice per chapter');
select tests.login('teacher2@alpha.test');
select throws_ok($$ select public.practice_activity((select a from ids), tests.uid('student1@alpha.test')) $$,
  '42501', 'not_allowed', 'a teacher of another batch sees nothing');
select tests.login('student2@alpha.test');
select throws_ok($$ select public.practice_activity((select a from ids), tests.uid('student1@alpha.test')) $$,
  '42501', 'not_allowed', 'a classmate sees nothing');

-- ---------------------------------------------------------------- teacher approval for institute artifacts
select tests.login('teacher1@alpha.test');
select lives_ok($$ insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id,
  input_hash, prompt_version, model, content)
  select a, 'institute', 'summary', physics, rotation, repeat('e', 64), 'studio-v1', 'fake', '{"sections":[]}' from ids $$,
  'a teacher generates an institute summary');
select results_eq($$ select status, created_by from public.generated_artifacts where input_hash = repeat('e', 64) $$,
  $$ values ('draft', auth.uid()) $$, 'it starts as a draft by its author');
select throws_ok($$ update public.generated_artifacts set status = 'published' where input_hash = repeat('e', 64) $$,
  '23514', 'no_audience', 'nothing is published without an audience');
select throws_ok($$ insert into public.artifact_audience select id, (select by_ from ids), (select a from ids)
  from public.generated_artifacts where input_hash = repeat('e', 64) $$, '42501', null,
  'a teacher cannot publish to a batch they do not teach');
select lives_ok($$ insert into public.artifact_audience select id, (select bx from ids), (select a from ids)
  from public.generated_artifacts where input_hash = repeat('e', 64) $$, 'the teacher picks their own batch');
select is(tests.affected($$ update public.generated_artifacts set status = 'published'
  where input_hash = repeat('e', 64) $$), 1::bigint, 'the teacher approves and publishes');
select is((select approved_by from public.generated_artifacts where input_hash = repeat('e', 64)),
  auth.uid(), 'the approver is the caller');

select tests.login('student2@alpha.test');
select is((select count(*) from public.generated_artifacts where input_hash = repeat('e', 64)), 1::bigint,
  'students of the batch now read it');
select tests.login('teacher1@alpha.test');
select is(tests.affected($$ update public.generated_artifacts set content = '{"sections":[{"x":1}]}'
  where input_hash = repeat('e', 64) $$), 1::bigint, 'the teacher edits the published summary');
select tests.login('student2@alpha.test');
select is((select count(*) from public.generated_artifacts where input_hash = repeat('e', 64)), 0::bigint,
  'an edited artifact needs approval again before students read it');

-- ---------------------------------------------------------------- access ends with the membership
reset role;
update public.memberships set status = 'removed' where id = tests.mid('student1@alpha.test');
select tests.login('student1@alpha.test');
select is((select count(*) from public.generated_artifacts) + (select count(*) from public.practice_attempts),
  0::bigint, 'a removed student no longer reads their artifacts or tries');

select * from finish();
rollback;
