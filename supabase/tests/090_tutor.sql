-- Phase 6: tutor chats are student-private (T-ISO-01), staff see counts and reported answers only (ADR-026).
begin;
select tests.setup();
select plan(30);

create temp table ids as select
  tests.inst('alpha') as a,
  (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
  (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Chemistry') as chemistry,
  (select id from public.conversations where institute_id = tests.inst('alpha')) as conv,
  (select id from public.messages where institute_id = tests.inst('alpha') and role = 'assistant') as answer,
  (select id from public.messages where institute_id = tests.inst('alpha') and role = 'user') as question;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- owner reads and writes their own chat
select tests.login('student1@alpha.test');
select is((select count(*) from public.conversations), 1::bigint, 'student1 sees their own conversation');
select is((select count(*) from public.messages), 2::bigint, 'student1 sees their own messages');
select lives_ok($$ insert into public.messages (institute_id, conversation_id, role, content)
  select a, conv, 'user', 'Follow-up' from ids $$, 'student1 adds a message to their chat');
select lives_ok($$ insert into public.conversations (institute_id, subject_id, title)
  select a, physics, 'New chat' from ids $$, 'student1 opens a chat on a subject of their batch');
select throws_ok($$ insert into public.conversations (institute_id, subject_id, title)
  select a, chemistry, 'Other batch' from ids $$, '42501', null, 'no chat on a subject outside their batches');
select throws_ok($$ insert into public.conversations (institute_id, user_id, subject_id, title)
  select a, tests.uid('student2@alpha.test'), physics, 'Forged' from ids $$, '42501', null,
  'user_id cannot be chosen by the caller');
select is(tests.affected($$ update public.messages set feedback = 'down' where id = (select answer from ids) $$),
  1::bigint, 'student1 rates an answer');
select throws_ok($$ update public.messages set content = 'edited' where id = (select answer from ids) $$,
  '42501', null, 'message text cannot be edited');

-- ---------------------------------------------------------------- nobody else reads it (same institute)
select tests.login('student2@alpha.test');
select is((select count(*) from public.conversations), 0::bigint, 'classmate sees no conversation');
select is((select count(*) from public.messages), 0::bigint, 'classmate sees no message');
select throws_ok($$ insert into public.messages (institute_id, conversation_id, role, content)
  select a, conv, 'user', 'Injected' from ids $$, '42501', null, 'classmate cannot write into the chat');
select is(tests.affected($$ update public.messages set feedback = 'up' where id = (select answer from ids) $$),
  0::bigint, 'classmate cannot rate the answer');
select is(tests.affected($$ delete from public.conversations where id = (select conv from ids) $$),
  0::bigint, 'classmate cannot delete the chat');
select throws_ok($$ select public.report_answer((select answer from ids), 'x') $$, '42501', 'not_allowed',
  'classmate cannot report someone else''s answer');

select tests.login('teacher1@alpha.test');
select is((select count(*) from public.messages), 0::bigint, 'teacher of the batch never reads chat text');
select tests.login('owner@alpha.test');
select is((select count(*) from public.conversations) + (select count(*) from public.messages), 0::bigint,
  'owner never reads chats');

-- ---------------------------------------------------------------- report → teacher queue
select tests.login('student1@alpha.test');
select throws_ok($$ select public.report_answer((select question from ids), 'x') $$, '42501', 'not_allowed',
  'only assistant answers can be reported');
reset role;
insert into public.messages (institute_id, conversation_id, role, content, citations)
select a, conv, 'assistant', 'Second answer', '[{"source_kind":"institute"}]' from ids;
select tests.login('student1@alpha.test');
select isnt(public.report_answer((select id from public.messages where content = 'Second answer'), 'Wrong formula'),
  null, 'student1 reports their answer');
select is(public.report_answer((select id from public.messages where content = 'Second answer'), 'again'), null,
  'reporting twice adds nothing');
select is((select count(*) from public.answer_reports), 0::bigint, 'students do not read the report queue');

select tests.login('teacher1@alpha.test');
select results_eq($$ select question, answer, reason from public.answer_reports where answer = 'Second answer' $$,
  $$ values ('Follow-up', 'Second answer', 'Wrong formula') $$, 'teacher sees the question and the reported answer');
select throws_ok($$ select reported_by from public.answer_reports $$, '42501', null, 'staff never see who reported');
select is(tests.affected($$ update public.answer_reports set resolved_at = now(), resolved_by = auth.uid()
  where answer = 'Second answer' $$), 1::bigint, 'teacher resolves a report');
select throws_ok($$ update public.answer_reports set resolved_by = tests.uid('owner@alpha.test') $$, '42501', null,
  'a report cannot be resolved in someone else''s name');

-- ---------------------------------------------------------------- counts only (progress page)
select tests.login('teacher1@alpha.test');
select is(public.tutor_activity((select a from ids), tests.uid('student1@alpha.test')) -> 0 ->> 'doubts', '2',
  'teacher of the batch sees the number of doubts');
select ok(public.tutor_activity((select a from ids), tests.uid('student1@alpha.test'))::text not like '%private%',
  'the activity summary contains no chat text');
select tests.login('teacher2@alpha.test');
select throws_ok($$ select public.tutor_activity((select a from ids), tests.uid('student1@alpha.test')) $$,
  '42501', 'not_allowed', 'teacher of another batch sees nothing');
select tests.login('student2@alpha.test');
select throws_ok($$ select public.tutor_activity((select a from ids), tests.uid('student1@alpha.test')) $$,
  '42501', 'not_allowed', 'classmate sees nothing');

-- ---------------------------------------------------------------- retrieval returns the passage's institute
select tests.login('student1@alpha.test');
select is((select array_agg(distinct institute_id) from public.match_chunks(
  ('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector, 'canary bravozebra', (select physics from ids))),
  array[tests.inst('alpha')], 'match_chunks returns only own institute passages with their institute id');

-- ---------------------------------------------------------------- access ends with the membership
reset role;
update public.memberships set status = 'removed' where id = tests.mid('student1@alpha.test');
select tests.login('student1@alpha.test');
select is((select count(*) from public.conversations), 0::bigint, 'a removed student no longer reads the chat');

select * from finish();
rollback;
