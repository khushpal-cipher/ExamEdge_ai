-- R1.1 (ADR-038, ADR-040): Smart Study per topic (chats + retrieval) and moving students to their next batch.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select (select id from public.subjects where institute_id = tests.inst('alpha') and name = 'Physics') as physics,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Rotation') as rotation,
         (select id from public.chapters where institute_id = tests.inst('alpha') and name = 'Bonding') as bonding,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X') as bx,
         (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y') as by_,
         (select id from public.batches where institute_id = tests.inst('bravo') and name = 'Batch Y') as bravo_y;
grant select on ids to authenticated;
insert into public.chapters (institute_id, subject_id, name)
values (tests.inst('alpha'), (select physics from ids), 'Empty topic');

-- ---------------------------------------------------------------- chats and retrieval per topic
select tests.login('student1@alpha.test');
select lives_ok(format($$ insert into public.conversations (institute_id, subject_id, chapter_id, title)
  values (%L, %L, %L, 'q') $$, tests.inst('alpha'), (select physics from ids), (select rotation from ids)),
  'a student opens a chat on a topic of their subject');
select throws_ok(format($$ insert into public.conversations (institute_id, subject_id, chapter_id, title)
  values (%L, %L, %L, 'q') $$, tests.inst('alpha'), (select physics from ids), (select bonding from ids)),
  '23503', null, 'the chat''s topic must belong to its subject');

create temp table q on commit drop as select ('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector as v;
grant select on q to authenticated;
select ok((select count(*) from public.match_chunks((select v from q), 'torque', (select physics from ids), 30,
  (select rotation from ids))) > 0, 'retrieval finds the topic''s notes');
select is((select count(*) from public.match_chunks((select v from q), 'torque', (select physics from ids), 30,
  tests.id_of('chapters', 'name', 'Empty topic'))), 0::bigint, 'and nothing from another topic');
select is((select count(*) from public.match_chunks((select v from q), 'torque', (select physics from ids))),
  (select count(*) from public.match_chunks((select v from q), 'torque', (select physics from ids), 30,
   (select rotation from ids))), 'no topic = the whole subject');

-- ---------------------------------------------------------------- moving students to the next batch
select tests.login('teacher1@alpha.test');
select is(public.move_students((select bx from ids), (select by_ from ids), array[tests.mid('student1@alpha.test')]),
  0, 'a teacher cannot move students');
select tests.login('student1@alpha.test');
select is(public.move_students((select bx from ids), (select by_ from ids), array[tests.mid('student1@alpha.test')]),
  0, 'a student cannot move themself');
select tests.login('owner@alpha.test');
select throws_ok(format($$ select public.move_students(%L, %L, %L) $$, (select bx from ids), (select bravo_y from ids),
  array[tests.mid('student1@alpha.test')]), '23503', null, 'nobody moves into another institute''s batch');
select is((select left_at from public.batch_members where membership_id = tests.mid('student1@alpha.test')), null,
  'and the refused move changed nothing');
select is(public.move_students((select bx from ids), (select by_ from ids),
  array[tests.mid('student1@alpha.test'), tests.mid('teacher1@alpha.test')]), 1, 'the owner moves a student (teachers stay)');
select isnt((select left_at from public.batch_members
  where batch_id = (select bx from ids) and membership_id = tests.mid('student1@alpha.test')), null,
  'the old batch row is kept as history');
select is((select left_at from public.batch_members
  where batch_id = (select by_ from ids) and membership_id = tests.mid('student1@alpha.test')), null,
  'and the student is current in the new batch');
select is(public.move_students((select bx from ids), (select by_ from ids), array[tests.mid('student1@alpha.test')]),
  0, 'moving again does nothing');

select * from finish();
rollback;
