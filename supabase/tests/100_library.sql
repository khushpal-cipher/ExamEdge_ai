-- Phase 8: shared library (ADR-027). Everyone signed in reads published items only; only an aal2 platform admin
-- writes; nothing publishes without a reviewer (AC8.2); provenance is required (AC8.3); platform AI calls are metered.
begin;
select tests.setup();
select plan(43);

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
-- The demo seed's library (if seeded) would clash with the fixture names and counts; rolled back at the end.
delete from public.library_subjects;

-- A one-hot 1024-dim vector, so each test chunk has a known nearest query.
create function pg_temp.vec(i int) returns extensions.vector language sql as $$
  select ('[' || array_to_string(array_fill(0, array[i - 1]) || 1 || array_fill(0, array[1024 - i]), ',') || ']')::extensions.vector
$$;
grant execute on function pg_temp.vec(int) to authenticated;

-- Fixture written as an ops script would (auth.uid() is null, so the trigger keeps every column).
create temp table lib as
with s as (
  insert into public.library_subjects (exam_id, name) select id, 'Physics' from public.exams where code = 'JEE_MAIN'
  returning id),
o as (
  insert into public.library_subjects (exam_id, name) select id, 'Biology' from public.exams where code = 'NEET_UG'
  returning id),
c as (insert into public.library_chapters (subject_id, position, name) select id, 1, 'Gravitation' from s returning id),
t as (insert into public.library_topics (chapter_id, position, name) select id, 1, 'Escape velocity' from c returning id)
select (select id from s) as subject, (select id from o) as other, (select id from t) as topic;
grant select on lib to authenticated;

insert into public.library_items (topic_id, kind, content, status, provenance, reviewed_by, reviewed_at, published_at)
select topic, 'explanation', '{"body": "Escape velocity is sqrt(2GM/R)."}', 'published', 'Hand-written for the test',
       tests.uid('root@examedge.test'), now(), now() from lib;
insert into public.library_items (topic_id, kind, content, provenance)
select topic, 'formula_sheet', '{"body": "Draft formula sheet"}', 'Hand-written for the test' from lib;
insert into public.library_chunks (item_id, subject_id, chunk_index, content, embedding, embedding_model)
select i.id, lib.subject, 0, i.content ->> 'body', pg_temp.vec(case i.status when 'published' then 1 else 2 end), 'fake'
from public.library_items i, lib;
create temp table item as select
  (select id from public.library_items where status = 'published') as published,
  (select id from public.library_items where status = 'draft') as draft;
grant select on item to authenticated;

-- ---------------------------------------------------------------- readers
select tests.as_anon();
select throws_ok($$ select count(*) from public.library_items $$, '42501', null, 'anon reads no library');

select tests.login('student1@alpha.test');
select is((select count(*) from public.library_subjects), 2::bigint, 'student reads the library tree');
select is((select count(*) from public.library_items), 1::bigint, 'student reads published items only');
select is((select count(*) from public.library_chunks), 1::bigint, 'student reads chunks of published items only');
select is((select array_agg(item_id) from public.match_library_chunks(pg_temp.vec(2), 'draft formula', (select subject from lib))),
  (select array[published] from item), 'retrieval returns published chunks only, even for the draft''s own words');
select is((select count(*) from public.match_library_chunks(pg_temp.vec(1), 'escape', (select other from lib))),
  0::bigint, 'retrieval stays inside the requested library subject');
select is((select topic from public.match_library_chunks(pg_temp.vec(1), 'escape', (select subject from lib))),
  'Escape velocity', 'retrieval names the topic for the citation');
-- fused score above one rank-1 hit = the keyword half ranked it too ("speed" is not in the text; the old AND query missed)
select ok((select score > 1.0 / 61 from public.match_library_chunks(pg_temp.vec(1), 'what is the escape speed',
  (select subject from lib))), 'one matching content word is enough for the keyword half');
select throws_ok($$ insert into public.library_items (topic_id, kind, content, provenance)
  select topic, 'explanation', '{"body": "x"}', 'student wrote this' from lib $$, '42501', null,
  'student cannot add library items');
select is(tests.affected($$ update public.library_items set content = '{"body": "vandalised"}' $$), 0::bigint,
  'student cannot edit library items');
select throws_ok($$ insert into public.library_subjects (exam_id, name) select id, 'Maths' from public.exams limit 1 $$,
  '42501', null, 'student cannot change the tree');
select throws_ok($$ select public.publish_library_item((select draft from item), '[]', 'fake') $$, '42501',
  'not_allowed', 'student cannot publish');

-- ---------------------------------------------------------------- institute subject mapping
select tests.login('teacher1@alpha.test');
select is(tests.affected(format($$ update public.subjects set library_subject_id = %L
  where institute_id = %L and name = 'Physics' $$, (select subject from lib), tests.inst('alpha'))), 0::bigint,
  'teacher cannot map a subject to the library');
select tests.login('owner@bravo.test');
select is(tests.affected(format($$ update public.subjects set library_subject_id = %L
  where institute_id = %L $$, (select subject from lib), tests.inst('alpha'))), 0::bigint,
  'other institute''s owner cannot map alpha''s subjects');
select tests.login('owner@alpha.test');
select is(tests.affected(format($$ update public.subjects set library_subject_id = %L
  where institute_id = %L and name = 'Physics' $$, (select subject from lib), tests.inst('alpha'))), 1::bigint,
  'owner maps Physics to the library subject');
select is(tests.affected(format($$ update public.subjects set library_subject_id = null
  where institute_id = %L and name = 'Physics' $$, tests.inst('alpha'))), 1::bigint, 'owner removes the mapping');

-- ---------------------------------------------------------------- platform admin without MFA
select tests.login('root@examedge.test');
select is((select count(*) from public.library_items), 1::bigint, 'platform admin without MFA sees no drafts');
select throws_ok($$ insert into public.library_items (topic_id, kind, content, provenance)
  select topic, 'explanation', '{"body": "x"}', 'Written by the founder' from lib $$, '42501', null,
  'platform admin without MFA cannot write');

-- ---------------------------------------------------------------- review workflow (AC8.2, AC8.3)
select tests.login('root@examedge.test', 'aal2');
select is((select count(*) from public.library_items), 2::bigint, 'platform admin with MFA sees drafts');
select throws_ok($$ insert into public.library_items (topic_id, kind, content, provenance, status)
  select topic, 'explanation', '{"body": "x"}', 'Written by the founder', 'published' from lib $$, '42501', null,
  'status cannot be set on insert');
select throws_ok($$ insert into public.library_items (topic_id, kind, content)
  select topic, 'explanation', '{"body": "x"}' from lib $$, '23502', null, 'provenance is required (AC8.3)');
select throws_ok($$ insert into public.library_items (topic_id, kind, content, provenance)
  select topic, 'question', '{"body": "x"}', 'Written by the founder' from lib $$, '23514', null,
  'only text kinds for now');
insert into public.library_items (topic_id, kind, content, provenance)
select topic, 'worked_example', '{"body": "A ball leaves Earth at 11.2 km/s."}', 'Written by the founder' from lib;
create temp table fresh as select id from public.library_items where kind = 'worked_example';
select is((select row(status, version, created_by, reviewed_by) from public.library_items where id = (select id from fresh)),
  row('draft'::text, 1, tests.uid('root@examedge.test'), null::uuid), 'a new item starts as draft v1 by its author');
select throws_ok($$ update public.library_items set status = 'published' where id = (select id from fresh) $$,
  '23514', null, 'a draft cannot be published without review (AC8.2)');
select throws_ok($$ select public.publish_library_item((select id from fresh),
  jsonb_build_array(jsonb_build_object('content', 'x', 'embedding', pg_temp.vec(3)::text)), 'fake') $$,
  '23514', 'not_reviewed', 'publish refuses an unreviewed item (AC8.2)');
update public.library_items set status = 'reviewed' where id = (select id from fresh);
select ok((select reviewed_by = tests.uid('root@examedge.test') and reviewed_at is not null
  from public.library_items where id = (select id from fresh)), 'reviewing records the caller as the reviewer');
select lives_ok($$ select public.publish_library_item((select id from fresh),
  jsonb_build_array(jsonb_build_object('content', 'A ball leaves Earth at 11.2 km/s.', 'embedding', pg_temp.vec(3)::text)),
  'fake') $$, 'publish a reviewed item');
select is((select row(status, published_at is not null) from public.library_items where id = (select id from fresh)),
  row('published'::text, true), 'item is published with a timestamp');
select is((select array_agg(subject_id) from public.library_chunks where item_id = (select id from fresh)),
  (select array[subject] from lib), 'chunks carry the item''s library subject');
select is((select count(*) from public.audit_events where action = 'library.publish' and target_id = (select id from fresh)),
  1::bigint, 'publishing is audited');

select tests.login('student1@alpha.test');
select is((select count(*) from public.match_library_chunks(pg_temp.vec(3), 'ball', (select subject from lib))
  where item_id = (select id from fresh)), 1::bigint, 'students retrieve the newly published item');

select tests.login('root@examedge.test', 'aal2');
update public.library_items set content = '{"body": "Edited after publishing."}' where id = (select id from fresh);
select is((select row(status, version, reviewed_by) from public.library_items where id = (select id from fresh)),
  row('draft'::text, 2, null::uuid), 'an edit sends a published item back to draft and needs a new review');
update public.library_items set status = 'retired' where id = (select published from item);
select tests.login('student1@alpha.test');
select is((select count(*) from public.library_items), 0::bigint, 'edited and retired items disappear for students');
select is((select count(*) from public.match_library_chunks(pg_temp.vec(1), 'escape ball', (select subject from lib))),
  0::bigint, 'and from retrieval');

-- ---------------------------------------------------------------- platform metering (library_embed)
select throws_ok($$ select * from public.ai_reserve_platform('library_embed', 'fake', 'fake-bow-1', 10) $$, '42501',
  'not_allowed', 'a student cannot reserve platform AI');
select throws_ok($$ select * from public.ai_reserve(tests.inst('alpha'), 'library_embed', 'fake', 'fake-bow-1', 10) $$,
  '22023', 'unknown_feature', 'a member cannot use a platform feature');
select tests.login('root@examedge.test', 'aal2');
create temp table rec as select record_id, blocked from public.ai_reserve_platform('library_embed', 'fake', 'fake-bow-1', 10);
select is((select row(institute_id, user_id, outcome) from public.usage_records where id = (select record_id from rec)),
  row(null::uuid, tests.uid('root@examedge.test'), 'pending'::text), 'platform reservation has no institute');
select lives_ok($$ select public.ai_settle_platform((select record_id from rec), '{"input_tokens": 7}', 0, 'ok') $$,
  'platform admin settles the call');
select throws_ok($$ select * from public.ai_reserve_platform('tutor', 'fake', 'fake', 10) $$, '22023',
  'unknown_feature', 'member features cannot be reserved as platform calls');
reset role;
update private.settings set ai_enabled = false where id;
select tests.login('root@examedge.test', 'aal2');
select is((select blocked from public.ai_reserve_platform('library_embed', 'fake', 'fake-bow-1', 10)), 'ai_disabled',
  'the global kill switch blocks library AI too');
select tests.login('owner@alpha.test');
select is((select count(*) from public.usage_records where institute_id is null), 0::bigint,
  'institute owners never see platform usage');

-- AC8.4 keyword half: OR of content words, stop words dropped (ADR-027)
select is(private.keyword_query('What is the dimensional formula of Planck''s constant?')::text,
  '''constant'' | ''dimensional'' | ''formula'' | ''planck''', 'keyword query ORs the content words');
select is(private.keyword_query('what is the'), null, 'a stop-word-only question has no keyword query');

select * from finish();
rollback;
