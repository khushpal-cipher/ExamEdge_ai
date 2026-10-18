-- R1.2 (migration 24): a teacher's uploaded notes publish themselves when their first version becomes current;
-- AI notes and notes that already had a version keep their status.
begin;
select tests.setup();
select plan(5);

create function pg_temp.doc(t text, k text) returns uuid language plpgsql as $$
declare d uuid; v uuid;
begin
  insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title, kind)
  select n.institute_id, n.subject_id, n.chapter_id, n.subtopic_id, t, k
  from public.documents n where n.institute_id = tests.inst('alpha') and n.title = 'Physics notes'
  returning id into d;
  v := gen_random_uuid();
  insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes,
                                        processing_status)
  values (v, tests.inst('alpha'), d, 1, tests.inst('alpha') || '/' || d || '/' || v, 'application/pdf', 1000, 'ready');
  update public.documents set current_version_id = v where id = d; -- what the worker does when a version is ready
  return d;
end $$;

select pg_temp.doc('Typed by teacher', 'file'), pg_temp.doc('AI draft', 'ai_notes');
select is((select status from public.documents where title = 'Typed by teacher'), 'published',
  'uploaded notes publish themselves once read');
select isnt((select published_at from public.documents where title = 'Typed by teacher'), null, 'with a publish time');
select is((select status from public.documents where title = 'AI draft'), 'draft',
  'AI notes stay a draft for the teacher to check');

-- A withdrawn document that gets a new version stays withdrawn.
update public.documents set status = 'withdrawn' where title = 'Typed by teacher';
select lives_ok($$ update public.documents set current_version_id = current_version_id where title = 'Typed by teacher' $$,
  'a later version change');
select is((select status from public.documents where title = 'Typed by teacher'), 'withdrawn',
  'does not republish withdrawn notes');

select * from finish();
rollback;
