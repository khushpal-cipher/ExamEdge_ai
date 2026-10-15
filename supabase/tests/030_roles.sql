-- Within-institute access: T-ISO-01 (student ↔ student), T-ISO-03 (teacher of batch X vs Y), role rules,
-- AC2.6 (audit on membership changes), AC2.7 (platform admin needs MFA), composite FKs (R-01).
begin;
select tests.setup();
select * from no_plan();

-- ---------------------------------------------------------------- T-ISO-01 students
select tests.login('student1@alpha.test');
select is((select count(*) from public.memberships), 1::bigint, 'student sees only own membership');
select is((select count(*) from public.profiles), 1::bigint, 'student sees only own profile');
select is((select count(*) from public.batch_members), 1::bigint, 'student sees only own batch membership');
select is((select count(*) from public.batches), 1::bigint, 'student sees only own batch');
select is((select name from public.subjects), 'Physics', 'student sees only subjects of own batch');
select is((select count(*) from public.chapters), 1::bigint, 'student sees only chapters of own subjects');
select is((select count(*) from public.invitations), 0::bigint, 'student sees no invitations');
select is((select count(*) from public.audit_events), 0::bigint, 'student sees no audit events');
select is(tests.affected(format($$ update public.profiles set full_name = 'x' where user_id = %L $$,
  tests.uid('student2@alpha.test'))), 0::bigint, 'student cannot edit another student''s profile');
select is(tests.affected($$ update public.profiles set full_name = 'Riya' where user_id = auth.uid() $$), 1::bigint,
  'student can edit own name');
select is(tests.affected($$ update public.memberships set role = 'owner' $$), 0::bigint,
  'student cannot change own role');
select throws_ok(format($$ insert into public.batches (institute_id, name) values (%L, 'Hack') $$, tests.inst('alpha')),
  '42501', null, 'student cannot create batches');
select throws_ok(format($$ select public.create_invitation(%L, 'friend@x.test', 'student') $$, tests.inst('alpha')),
  '42501', null, 'student cannot invite');
select is((select count(*) from public.consent_records), 1::bigint, 'student sees own consent record');
select tests.login('student2@alpha.test');
select is((select count(*) from public.consent_records), 0::bigint, 'student cannot see another student''s consent');
select throws_ok(format($$ insert into public.consent_records (user_id, kind, policy_version, method)
  values (%L, 'terms', 'v1', 'x') $$, tests.uid('student1@alpha.test')), '42501', null,
  'student cannot record consent for someone else');
select tests.login('student3@alpha.test');
select is((select name from public.subjects), 'Chemistry', 'batch Y student sees only Chemistry');

-- ---------------------------------------------------------------- T-ISO-03 teachers
select tests.login('teacher1@alpha.test');
select set_eq($$ select user_id from public.memberships $$,
  array[tests.uid('teacher1@alpha.test'), tests.uid('student1@alpha.test'), tests.uid('student2@alpha.test')],
  'teacher sees own membership and students of own batch only');
select is((select count(*) from public.audit_events), 0::bigint, 'teacher sees no audit events');
select is((select count(*) from public.invitations), 0::bigint, 'teacher sees only invitations they created');
select throws_ok(format($$ insert into public.batch_members values (%L, %L, %L, 'student') $$,
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y'),
  tests.mid('student1@alpha.test'), tests.inst('alpha')),
  '42501', null, 'teacher cannot enrol students into a batch they do not teach');
select lives_ok(format($$ insert into public.batch_members values (%L, %L, %L, 'student') $$,
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X'),
  tests.mid('student3@alpha.test'), tests.inst('alpha')),
  'teacher can enrol a student into own batch');
select throws_ok(format($$ select public.create_invitation(%L, 'kid@x.test', 'student', %L) $$, tests.inst('alpha'),
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y')),
  '42501', null, 'teacher cannot invite into a batch they do not teach');
select ok(length(public.create_invitation(tests.inst('alpha'), 'Kid@X.test', 'student',
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch X'))) = 64,
  'teacher can invite a student into own batch (raw token returned once)');
select is((select email from public.invitations), 'kid@x.test', 'invited email stored lowercase; teacher sees own invite');
select throws_ok(format($$ select public.create_invitation(%L, 't@x.test', 'teacher') $$, tests.inst('alpha')),
  '42501', null, 'teacher cannot invite teachers');
select throws_ok($$ select token_hash from public.invitations $$, '42501', null, 'token hashes are not readable');

-- ---------------------------------------------------------------- admins and owners, AC2.6 audit
select tests.login('admin@alpha.test');
select is((select count(*) from public.memberships), 7::bigint, 'admin sees all memberships of the institute');
select throws_ok(format($$ update public.memberships set role = 'admin' where user_id = %L $$,
  tests.uid('teacher1@alpha.test')), '42501', null, 'admin cannot promote to admin');
select throws_ok(format($$ select public.create_invitation(%L, 'a2@x.test', 'admin') $$, tests.inst('alpha')),
  '42501', null, 'admin cannot invite admins');
select is(tests.affected(format($$ update public.memberships set status = 'removed' where user_id = %L $$,
  tests.uid('student2@alpha.test'))), 1::bigint, 'admin can remove a student');
select ok((select removed_at is not null from public.memberships where user_id = tests.uid('student2@alpha.test')),
  'removal timestamp set by trigger');
select tests.login('owner@alpha.test');
select is(tests.affected(format($$ update public.memberships set role = 'admin' where user_id = %L $$,
  tests.uid('teacher1@alpha.test'))), 1::bigint, 'owner can promote a teacher to admin');
select tests.logout();
select ok(exists (select 1 from public.audit_events where action = 'memberships.update' and actor_kind = 'user'
  and actor_user_id = tests.uid('owner@alpha.test') and metadata -> 'old' ->> 'role' = 'teacher'
  and metadata -> 'new' ->> 'role' = 'admin'), 'role change audited with actor and old/new role (AC2.6)');
select ok(exists (select 1 from public.audit_events where action = 'memberships.update'
  and actor_user_id = tests.uid('admin@alpha.test') and metadata -> 'new' ->> 'status' = 'removed'),
  'removal audited (AC2.6)');
select ok(exists (select 1 from public.audit_events where action = 'batch_members.insert'
  and actor_user_id = tests.uid('teacher1@alpha.test')), 'batch enrolment audited (AC2.6)');
select is_empty($$ select 1 from public.audit_events where metadata::text like '%@%' $$,
  'audit metadata never contains emails');
select tests.login('student2@alpha.test');
select is((select count(*) from public.institutes), 0::bigint, 'removed member loses access immediately');

-- ---------------------------------------------------------------- suspended institute
select tests.logout();
update public.institutes set status = 'suspended' where slug = 'alpha';
select tests.login('owner@alpha.test');
select is((select count(*) from public.batches), 0::bigint, 'suspended institute: members see nothing');
select tests.logout();
update public.institutes set status = 'pilot' where slug = 'alpha';

-- ---------------------------------------------------------------- AC2.7 platform admin MFA
insert into private.platform_admins (user_id, granted_by) values (tests.uid('outsider@nowhere.test'), 'test');
select tests.login('outsider@nowhere.test', 'aal1');
select is((select count(*) from public.institutes), 0::bigint, 'platform admin without MFA sees no institutes');
select tests.login('outsider@nowhere.test', 'aal2');
select is((select count(*) from public.institutes where slug in ('alpha', 'bravo')), 2::bigint,
  'platform admin with MFA sees institutes');
select is((select count(*) from public.batches), 0::bigint, 'platform admin cannot read tenant data (T-SEC-15)');

-- ---------------------------------------------------------------- composite FKs and role guards (as table owner)
select tests.logout();
select throws_ok(format($$ insert into public.chapters (institute_id, subject_id, name) values (%L, %L, 'x') $$,
  tests.inst('alpha'), (select id from public.subjects where institute_id = tests.inst('bravo') limit 1)),
  '23503', null, 'chapter cannot point at another institute''s subject');
select throws_ok(format($$ insert into public.batch_members values (%L, %L, %L, 'student') $$,
  (select id from public.batches where institute_id = tests.inst('alpha') limit 1),
  tests.mid('student1@bravo.test'), tests.inst('alpha')),
  '23503', null, 'batch cannot contain another institute''s member');
select throws_ok(format($$ insert into public.batch_members values (%L, %L, %L, 'student') $$,
  (select id from public.batches where institute_id = tests.inst('alpha') and name = 'Batch Y'),
  tests.mid('teacher1@alpha.test'), tests.inst('alpha')),
  '23514', null, 'staff cannot be enrolled as a batch student');

-- ---------------------------------------------------------------- anon
select tests.as_anon();
select is((select name from public.resolve_institute('alpha.localhost')), 'Alpha Classes', 'anon can resolve a host');
select is_empty($$ select * from public.resolve_institute('evil.localhost') $$, 'unknown host resolves to nothing');
select throws_ok($$ select count(*) from public.institutes $$, '42501', null, 'anon cannot read tables');
select tests.logout();

select * from finish();
rollback;
