-- Phase 3 platform admin paths: quotas, create/suspend institute, branding (TH-15, AC2.7, T-SEC-04).
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

select is((select count(*) from public.institute_quotas where institute_id in (tests.inst('alpha'), tests.inst('bravo'))),
  2::bigint, 'every institute gets a default quota row');

-- ---------------------------------------------------------------- institute members
select tests.login('owner@alpha.test');
select is((select count(*) from public.institute_quotas), 1::bigint, 'owner reads own institute quotas only');
select is(tests.affected($$ update public.institute_quotas set student_daily_messages = 9999 $$), 0::bigint,
  'owner cannot change quotas');
select is(tests.affected($$ update public.institutes set status = 'active' $$), 0::bigint,
  'owner cannot change institute status');
select throws_ok($$ select public.create_institute('evil', 'Evil', 'evil.localhost', 'a@b.test') $$, '42501', null,
  'owner cannot create institutes');
select tests.login('teacher1@alpha.test');
select is((select count(*) from public.institute_quotas), 0::bigint, 'teacher cannot read quotas');
select tests.login('student1@alpha.test');
select is((select count(*) from public.institute_quotas), 0::bigint, 'student cannot read quotas');

-- ---------------------------------------------------------------- platform admin without MFA
select tests.login('root@examedge.test');
select is((select count(*) from public.institutes), 0::bigint, 'platform admin without MFA sees no institutes');
select throws_ok($$ select public.create_institute('gamma', 'Gamma', 'gamma.localhost', 'o@gamma.test') $$, '42501',
  null, 'platform admin without MFA cannot create institutes');
select is(tests.affected($$ update public.institute_quotas set hard_stop = false $$), 0::bigint,
  'platform admin without MFA cannot change quotas');

-- ---------------------------------------------------------------- platform admin with MFA
select tests.login('root@examedge.test', 'aal2');
select ok((select count(*) from public.institutes) >= 2, 'platform admin with MFA lists institutes');
select is((select count(*) from public.memberships), 0::bigint, 'platform admin still reads no memberships (TH-15)');
select is((select count(*) from public.batches), 0::bigint, 'platform admin still reads no batches (TH-15)');
select is((select count(*) from public.invitations), 0::bigint, 'platform admin still reads no invitations (TH-15)');

select throws_ok($$ select public.create_institute('admin', 'X', 'admin.localhost', 'o@x.test') $$, 'P0001',
  'slug_reserved', 'reserved slug rejected');
select throws_ok($$ select public.create_institute('gamma', 'Gamma', 'alpha.localhost', 'o@gamma.test') $$, 'P0001',
  'host_mismatch', 'host must belong to the slug');
select throws_ok($$ select public.create_institute('gamma', 'Gamma', 'gamma', 'o@gamma.test') $$, 'P0001',
  'host_mismatch', 'host must have a domain part');
select throws_ok($$ select public.create_institute('ga.*', 'Gamma', 'ga.*.localhost', 'o@gamma.test') $$, 'P0001',
  'slug_invalid', 'slug pattern enforced before building the host check');

create temp table tok as select public.create_institute('Gamma', ' Gamma Classes ', 'gamma.localhost', 'Owner@Gamma.test') t;
select is((select r.name from public.resolve_institute('gamma.localhost') r), 'Gamma Classes',
  'new institute resolves by host');
select is((select count(*) from public.institute_quotas q join public.institutes i on i.id = q.institute_id
  where i.slug = 'gamma'), 1::bigint, 'new institute has quotas');
reset role;
select is((select email || '/' || role from public.invitations
  where token_hash = sha256(convert_to((select t from tok), 'UTF8'))), 'owner@gamma.test/owner',
  'owner invitation stored by hash for the lowercased email');
select is((select count(*) from public.memberships m join public.institutes i on i.id = m.institute_id
  where i.slug = 'gamma'), 0::bigint, 'no membership until the owner accepts');

select tests.login('root@examedge.test', 'aal2');
select is(tests.affected(format($$ update public.institutes set status = 'suspended' where id = %L $$,
  tests.inst('bravo'))), 1::bigint, 'platform admin suspends an institute');
select is(tests.affected(format($$ update public.institute_quotas set student_daily_messages = 25
  where institute_id = %L $$, tests.inst('alpha'))), 1::bigint, 'platform admin changes quotas');
select is(tests.affected(format($$ update public.institutes set branding = '{"color": "#123abc"}' where id = %L $$,
  tests.inst('alpha'))), 1::bigint, 'platform admin sets a brand colour');
select throws_ok(format($$ update public.institutes set branding = '{"color": "red;}body{x"}' where id = %L $$,
  tests.inst('alpha')), '23514', null, 'brand colour must be a hex colour (rendered into CSS)');
select throws_ok(format($$ update public.institutes set branding = '{"logo": "http://x"}' where id = %L $$,
  tests.inst('alpha')), '23514', null, 'unknown branding keys rejected');
select throws_ok(format($$ update public.institutes set slug = 'x' where id = %L $$, tests.inst('alpha')), '42501',
  null, 'slug is not updatable (hosts depend on it)');

select tests.login('owner@bravo.test');
select is((select count(*) from public.batches), 0::bigint, 'suspended institute: owner reads nothing');

reset role;
select is((select actor_kind from public.audit_events where action = 'institutes.update'
  and institute_id = tests.inst('bravo')), 'platform_admin', 'suspension audited as a platform admin action');
select is((select count(*) from public.audit_events where action = 'institute_quotas.update'
  and institute_id = tests.inst('alpha')), 1::bigint, 'quota change audited');
select is((select count(*) from public.audit_events a join public.institutes i on i.id = a.institute_id
  where i.slug = 'gamma' and a.action in ('institutes.insert', 'invitations.insert')
  and a.actor_kind = 'platform_admin'), 2::bigint, 'institute creation and owner invitation audited');

select * from finish();
rollback;
