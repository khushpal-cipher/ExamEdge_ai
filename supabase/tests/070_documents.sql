-- Phase 4: documents. Upload/queue/publish rules, AC4.3 withdrawn = invisible at once, teachers publish only to their
-- batches, students never see versions, T-ISO-06 retrieval canary, T-SEC-07 (database side: which objects a user may
-- sign or download), T-ISO-08 worker tenant context, and the worker service account.
begin;
select tests.setup();
select * from no_plan();

-- Ids looked up once (temp tables readable by the API roles while the test acts as them).
create temp table ids on commit drop as
  select i.slug, i.id as inst,
         (select id from public.subjects s where s.institute_id = i.id and s.name = 'Physics') as physics,
         (select id from public.batches b where b.institute_id = i.id and b.name = 'Batch X') as bx,
         (select id from public.batches b where b.institute_id = i.id and b.name = 'Batch Y') as by_,
         (select id from public.documents d where d.institute_id = i.id and d.title = 'Physics notes') as notes,
         (select current_version_id from public.documents d where d.institute_id = i.id and d.title = 'Physics notes')
           as notes_v
  from public.institutes i where i.slug in ('alpha', 'bravo');
create temp table new_doc (id uuid, v uuid, path text) on commit drop;
grant select on ids, new_doc to authenticated, worker;

-- Files the policies are checked against (inserted as postgres, as the Storage API does after an upload).
insert into storage.objects (bucket_id, name) select 'documents', v.storage_path from public.document_versions v
  where not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = v.storage_path);

-- ---------------------------------------------------------------- teacher uploads (alpha)
select tests.login('teacher1@alpha.test');
select lives_ok($$
  insert into public.documents (institute_id, subject_id, title)
  select inst, physics, 'Teacher notes' from ids where slug = 'alpha' $$,
  'teacher creates a document (insert … returning sees the new row)');
select tests.logout();
insert into new_doc select id, gen_random_uuid() from public.documents where title = 'Teacher notes';
update new_doc set path = (select inst from ids where slug = 'alpha') || '/' || id || '/' || v;

select tests.login('teacher1@alpha.test');
select throws_ok($$
  insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes)
  select n.v, i.inst, n.id, 1, i.inst || '/' || i.notes || '/' || n.v, 'application/pdf', 100
  from ids i, new_doc n where i.slug = 'alpha' $$,
  '23514', null, 'storage path must name the version''s own document');
select lives_ok($$
  insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes)
  select n.v, i.inst, n.id, 1, n.path, 'application/pdf', 100 from ids i, new_doc n where i.slug = 'alpha' $$,
  'teacher adds version 1 (uploading)');
select lives_ok($$ insert into storage.objects (bucket_id, name) select 'documents', path from new_doc $$,
  'teacher may upload the file of an uploading version');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  select 'documents', inst || '/' || gen_random_uuid() || '/' || gen_random_uuid() from ids where slug = 'alpha' $$,
  '42501', null, 'teacher cannot upload a file that no version row names');
select throws_ok($$ update public.document_versions set processing_status = 'ready' where id = (select v from new_doc) $$,
  '42501', 'invalid_status_change', 'teacher cannot mark a version ready (only the worker can)');
select is(tests.affected($$ update public.document_versions set processing_status = 'queued'
  where id = (select v from new_doc) $$), 1::bigint, 'teacher queues the uploaded version');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', path || 'x' from new_doc $$,
  '42501', null, 'no upload once the version left "uploading"');
select throws_ok($$ update public.documents set status = 'published' where id = (select id from new_doc) $$,
  'P0001', 'document_not_ready', 'a document without a processed version cannot be published');
select throws_ok($$ insert into public.document_audience (document_id, batch_id, institute_id)
  select n.id, i.by_, i.inst from ids i, new_doc n where i.slug = 'alpha' $$,
  '42501', null, 'teacher1 cannot publish to Batch Y (does not teach it)');
select lives_ok($$ insert into public.document_audience (document_id, batch_id, institute_id)
  select n.id, i.bx, i.inst from ids i, new_doc n where i.slug = 'alpha' $$,
  'teacher1 adds Batch X (teaches it) to the audience');
select throws_ok($$ insert into public.document_audience (document_id, batch_id, institute_id)
  select n.id, i.bx, a.inst from ids i, ids a, new_doc n where i.slug = 'bravo' and a.slug = 'alpha' $$,
  '42501', null, 'a bravo batch cannot be attached to an alpha document');
select is((select count(*) from public.documents where institute_id = (select inst from ids where slug = 'bravo')),
  0::bigint, 'teacher sees no bravo documents');

-- ---------------------------------------------------------------- the worker queue (T-ISO-08)
select tests.login('owner@alpha.test');
select throws_ok($$ select * from private.pending_jobs() $$, '42501', null, 'API users cannot list pending jobs');
select tests.logout();

grant usage on schema tests to worker;
set local role worker;
select is((select count(*) from public.document_versions), 0::bigint, 'worker without a tenant context sees nothing');
select set_eq($$ select version_id from private.pending_jobs() $$, $$ select v from new_doc $$,
  'pending_jobs lists the queued version (ids only)');
select set_config('app.institute_id', (select inst::text from ids where slug = 'alpha'), true);
select is((select count(*) from public.document_versions), 2::bigint, 'worker in alpha context sees alpha versions');
select is(tests.affected($$ update public.document_versions set processing_status = 'processing'
  where id = (select notes_v from ids where slug = 'bravo') $$), 0::bigint,
  'worker in alpha context cannot touch a bravo version (job with A context, B id)');
select is(tests.affected($$ delete from public.document_chunks
  where document_id = (select notes from ids where slug = 'bravo') $$), 0::bigint,
  'worker in alpha context cannot delete bravo chunks');
select throws_ok($$ insert into public.document_chunks (institute_id, document_id, document_version_id, subject_id,
    chunk_index, page_start, page_end, content, embedding, token_count)
  select inst, notes, notes_v, physics, 9, 1, 1, 'x', ('[' || repeat('0,', 1023) || '1]')::extensions.vector, 1
  from ids where slug = 'bravo' $$,
  '42501', null, 'worker in alpha context cannot write bravo chunks');
select throws_ok($$ insert into public.document_chunks (institute_id, document_id, document_version_id, subject_id,
    chunk_index, page_start, page_end, content, embedding, token_count)
  select a.inst, b.notes, b.notes_v, a.physics, 9, 1, 1, 'x', ('[' || repeat('0,', 1023) || '1]')::extensions.vector, 1
  from ids a, ids b where a.slug = 'alpha' and b.slug = 'bravo' $$,
  '23503', null, 'an alpha chunk cannot point at a bravo document (composite FK)');
select throws_ok($$ update public.document_versions set storage_path = 'x' where id = (select v from new_doc) $$,
  '42501', null, 'worker cannot rename a version''s file');
select is(tests.affected($$ update public.document_versions set processing_status = 'processing', claimed_at = now()
  where id = (select v from new_doc) and processing_status = 'queued' $$), 1::bigint, 'worker claims the queued version');
reset role;

-- ---------------------------------------------------------------- worker service account (storage downloads)
select tests.create_user('worker@service.test');
insert into private.service_accounts values (tests.uid('worker@service.test'), 'worker');
select tests.login('worker@service.test');
select is((select count(*) from storage.objects where name = (select path from new_doc)), 1::bigint,
  'worker account can download a file that is being processed');
select tests.logout();
select is((select count(*) from storage.objects o join ids i on o.name like i.inst || '/%'), 3::bigint,
  'fixture: three document files exist');
select tests.login('worker@service.test');
select is((select count(*) from storage.objects where bucket_id = 'documents'), 1::bigint,
  'worker account cannot download processed (ready) files');
select is((select count(*) from public.documents), 0::bigint, 'worker account reads no tenant rows');
select tests.logout();

-- ---------------------------------------------------------------- students (AC4.3, same-institute batches)
select tests.login('student1@alpha.test');
select is((select count(*) from public.documents), 1::bigint, 'student1 (Batch X) sees the published notes only');
select is((select count(*) from public.document_versions), 0::bigint, 'students never read versions');
select is((select count(*) from public.document_audience), 0::bigint, 'students never read audiences');
select is((select count(*) from public.document_chunks), 1::bigint, 'student1 reads chunks of the published notes');
select is((select count(*) from storage.objects where bucket_id = 'documents'), 1::bigint,
  'student1 may sign/download the current file of the published notes only');
select throws_ok($$ insert into public.documents (institute_id, subject_id, title)
  select inst, physics, 'Mine' from ids where slug = 'alpha' $$, '42501', null, 'students cannot create documents');
select is(tests.affected($$ update public.documents set status = 'withdrawn' $$), 0::bigint,
  'students cannot withdraw documents');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', path from new_doc $$,
  '42501', null, 'students cannot upload files');

-- T-ISO-06: alpha's student searches with bravo's canary phrase; nothing of bravo comes back.
select is((select count(*) from public.match_chunks(('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector,
  'canary bravozebra', (select physics from ids where slug = 'alpha'))
  where content like '%bravozebra%'), 0::bigint, 'T-ISO-06: bravo canary never retrieved by alpha');
select is((select count(*) from public.match_chunks(('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector,
  'canary bravozebra', (select physics from ids where slug = 'bravo'))), 0::bigint,
  'T-ISO-06: alpha student passing a bravo subject id gets nothing');
select is((select content from public.match_chunks(('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector,
  'alphazebra', (select physics from ids where slug = 'alpha')) limit 1), 'Torque notes canary alphazebra',
  'retrieval finds the student''s own institute notes');

select tests.login('student3@alpha.test');
select is((select count(*) from public.documents), 0::bigint, 'student3 (Batch Y) does not see Batch X notes');
select is((select count(*) from public.document_chunks), 0::bigint, 'student3 reads no Batch X chunks');
select is((select count(*) from storage.objects where bucket_id = 'documents'), 0::bigint,
  'student3 cannot sign Batch X files');

select tests.login('student1@bravo.test');
select is((select count(*) from storage.objects where name like (select inst from ids where slug = 'alpha') || '/%'),
  0::bigint, 'bravo student cannot sign alpha files');

-- AC4.3: withdraw → gone for students in the next statement.
select tests.login('teacher1@alpha.test');
select is(tests.affected($$ update public.documents set status = 'withdrawn'
  where id = (select notes from ids where slug = 'alpha') $$), 1::bigint, 'teacher withdraws the notes');
select isnt((select withdrawn_at from public.documents where id = (select notes from ids where slug = 'alpha')), null,
  'withdrawn_at is stamped');
select tests.login('student1@alpha.test');
select is((select count(*) from public.documents), 0::bigint, 'AC4.3: withdrawn notes invisible at once');
select is((select count(*) from public.document_chunks), 0::bigint, 'AC4.3: withdrawn chunks invisible at once');
select is((select count(*) from storage.objects where bucket_id = 'documents'), 0::bigint,
  'AC4.3: no signed URL for withdrawn notes');
select is((select count(*) from public.match_chunks(('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector,
  'alphazebra', (select physics from ids where slug = 'alpha'))), 0::bigint, 'AC4.3: tutor retrieval drops it too');

-- Republish, then soft delete: also gone.
select tests.login('teacher1@alpha.test');
select lives_ok($$ update public.documents set status = 'published' where id = (select notes from ids where slug = 'alpha') $$,
  'teacher republishes');
select lives_ok($$ update public.documents set deleted_at = now() where id = (select notes from ids where slug = 'alpha') $$,
  'teacher deletes (soft)');
select tests.login('student1@alpha.test');
select is((select count(*) from public.documents), 0::bigint, 'deleted notes invisible to students');
select tests.logout();

select ok(exists (select 1 from public.audit_events where target_type = 'documents' and action = 'documents.update'
  and metadata -> 'new' ->> 'status' = 'withdrawn'), 'withdrawal is audited');
select ok(exists (select 1 from public.audit_events where target_type = 'document_audience'
  and action = 'document_audience.insert'), 'audience change is audited');

-- DATABASE_DESIGN §7: deleting an institute removes all of its rows (a used question alone still cannot be deleted).
select throws_ok($$ delete from public.questions where institute_id = (select inst from ids where slug = 'alpha') $$,
  '23503', 'question_used_in_test', 'a question used in a test cannot be deleted on its own');
select throws_ok($$ delete from public.subjects where institute_id = (select inst from ids where slug = 'alpha') $$,
  '23503', 'question_used_in_test', 'nor through deleting its subject');
select lives_ok($$ delete from public.institutes where slug = 'alpha' $$, 'an institute delete cascades to every row');
select is((select count(*) from public.documents where institute_id = (select inst from ids where slug = 'alpha')),
  0::bigint, 'its documents are gone');

select * from finish();
rollback;
