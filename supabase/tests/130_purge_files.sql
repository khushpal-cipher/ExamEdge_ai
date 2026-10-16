-- Purge of unreachable files (ADR-031): which Storage objects are purgeable, that only the worker service account can
-- delete them (through the policies the Storage API runs under), and that purge_expired then drops deleted documents.
begin;
select tests.setup();
select * from no_plan();

create temp table ids on commit drop as
  select i.slug, i.id as inst,
         (select id from public.documents d where d.institute_id = i.id and d.title = 'Physics notes') as notes,
         (select id from public.subjects s where s.institute_id = i.id and s.name = 'Physics') as physics
  from public.institutes i where i.slug in ('alpha', 'bravo');
grant select on ids to authenticated, worker;

-- tests.setup() replaced the seeded institutes, so their files are real orphans; start from this test's files only.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects;
select set_config('storage.allow_delete_query', 'false', true);

-- Files as the Storage API stores them. Everything is two days old unless a test says otherwise.
insert into storage.objects (bucket_id, name) select 'documents', v.storage_path from public.document_versions v
  where not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = v.storage_path);
insert into storage.objects (bucket_id, name) select 'logos', l.name from (values
  ((select inst from ids where slug = 'alpha') || '/00000000-0000-4000-8000-00000000000a'),  -- in use
  ((select inst from ids where slug = 'alpha') || '/00000000-0000-4000-8000-00000000000b'),  -- replaced
  ((select inst from ids where slug = 'bravo') || '/00000000-0000-4000-8000-00000000000c')   -- replaced, new
) l (name);
insert into storage.objects (bucket_id, name)  -- left behind by a deleted institute
  values ('documents', '00000000-0000-4000-8000-0000000000dd/00000000-0000-4000-8000-0000000000de/x');
update storage.objects set created_at = now() - interval '2 days';
update storage.objects set created_at = now() where name like '%00000000000c';
update public.institutes set branding = jsonb_build_object('logo', id || '/00000000-0000-4000-8000-00000000000a')
  where slug = 'alpha';

-- alpha's notes were deleted 31 days ago; bravo's 29 days ago (still in the grace period).
update public.documents set deleted_at = now() - interval '31 days' where id = (select notes from ids where slug = 'alpha');
update public.documents set deleted_at = now() - interval '29 days' where id = (select notes from ids where slug = 'bravo');
create temp table expected on commit drop as
  select 'documents' as bucket, v.storage_path as name from public.document_versions v
  where v.document_id = (select notes from ids where slug = 'alpha')
  union all values ('documents', '00000000-0000-4000-8000-0000000000dd/00000000-0000-4000-8000-0000000000de/x'),
                   ('logos', (select inst from ids where slug = 'alpha') || '/00000000-0000-4000-8000-00000000000b');
grant select on expected to authenticated, worker;
create temp table total on commit drop as select count(*) as n from storage.objects;
grant select on total to authenticated;
select ok((select count(*) from expected) >= 3, 'fixture: alpha''s deleted notes have at least one file');

-- ---------------------------------------------------------------- what is purgeable
set local role worker;
select set_eq($$ select bucket, name from private.purgeable_files() $$, $$ select bucket, name from expected $$,
  'purgeable = files of documents past the 30-day grace, orphaned files and unused old logos');
reset role;
select tests.login('owner@alpha.test');
select throws_ok($$ select * from private.purgeable_files() $$, '42501', null, 'API users cannot list purgeable files');
select tests.logout();

-- ---------------------------------------------------------------- who may delete (as the Storage API does)
select set_config('storage.allow_delete_query', 'true', true);
create function pg_temp.delete_all() returns bigint language sql as $$
  with d as (delete from storage.objects returning 1) select count(*) from d $$;
grant execute on function pg_temp.delete_all() to authenticated;
select tests.login('owner@alpha.test');
select is(pg_temp.delete_all(), 0::bigint, 'an institute owner cannot delete any file, not even a purgeable one');
select tests.logout();
select tests.create_user('worker@service.test');
insert into private.service_accounts values (tests.uid('worker@service.test'), 'worker');

-- Before the files go, the deleted document stays: purge_expired waits for its files.
set local role worker;
select is(private.purge_expired() ->> 'documents', '0', 'a deleted document whose files remain is not purged yet');
reset role;

select tests.login('worker@service.test');
select is((select count(*) from storage.objects), (select count(*) from expected),
  'the worker account sees only purgeable files');
select is(pg_temp.delete_all(), (select count(*) from expected), 'the worker account deletes exactly the purgeable files');
select tests.logout();
select is((select count(*) from storage.objects o join expected e on e.bucket = o.bucket_id and e.name = o.name),
  0::bigint, 'purgeable files are gone');
select is((select count(*) from storage.objects), (select n - (select count(*) from expected) from total),
  'every other file is still there (live and recently deleted notes, the logo in use, the new logo)');

-- ---------------------------------------------------------------- documents after their files
set local role worker;
select is(private.purge_expired() ->> 'documents', '1', 'the deleted document past its grace is purged');
reset role;
select is((select count(*) from public.documents where id = (select notes from ids where slug = 'alpha')), 0::bigint,
  'alpha''s deleted notes are gone, with their versions');
select is((select count(*) from public.document_versions where document_id = (select notes from ids where slug = 'alpha')),
  0::bigint, 'versions cascade');
select is((select count(*) from public.documents where id = (select notes from ids where slug = 'bravo')), 1::bigint,
  'a document deleted 29 days ago can still be restored');

select * from finish();
rollback;
