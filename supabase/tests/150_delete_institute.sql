-- Platform admin deletes an institute created by mistake, only while nobody has joined (ADR-033).
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

select tests.login('root@examedge.test', 'aal2');
create temp table tok as select public.create_institute('gamma', 'Gamma', 'gamma.localhost', 'wrong@gamma.test') t;
create temp table g as select id from public.institutes where slug = 'gamma';
grant select on tok, g to authenticated;

-- ---------------------------------------------------------------- who may delete
select tests.login('owner@alpha.test');
select throws_ok(format($$ select public.delete_institute(%L, 'alpha') $$, tests.inst('alpha')), '42501', null,
  'an owner cannot delete their institute');
select tests.login('root@examedge.test');
select throws_ok(format($$ select public.delete_institute(%L, 'gamma') $$, (select id from g)), '42501', null,
  'platform admin without MFA cannot delete');

-- ---------------------------------------------------------------- guards
select tests.login('root@examedge.test', 'aal2');
select throws_ok(format($$ select public.delete_institute(%L, 'alpha') $$, tests.inst('alpha')), 'P0001',
  'has_members', 'an institute with members cannot be deleted');
select throws_ok(format($$ select public.delete_institute(%L, 'gamm') $$, (select id from g)), 'P0001',
  'confirm_mismatch', 'the typed address must match');
select throws_ok($$ select public.delete_institute(gen_random_uuid(), 'x') $$, 'P0002', 'not_found',
  'unknown institute');

-- ---------------------------------------------------------------- delete
select lives_ok(format($$ select public.delete_institute(%L, ' Gamma ') $$, (select id from g)),
  'platform admin with MFA deletes an institute nobody joined');
reset role;
select is((select count(*) from public.institutes where slug = 'gamma'), 0::bigint, 'institute gone');
select is((select count(*) from public.institute_domains where hostname = 'gamma.localhost'), 0::bigint,
  'its host no longer resolves');
select is((select count(*) from public.invitations where email = 'wrong@gamma.test'), 0::bigint,
  'its owner invitation is gone');
select is((select count(*) from public.institute_quotas where institute_id = (select id from g)), 0::bigint,
  'its quotas are gone');
select is((select actor_kind from public.audit_events where action = 'institutes.delete'
  and institute_id = (select id from g)), 'platform_admin', 'the delete is audited and the audit row stays');
select is((select count(*) from public.institutes where slug = 'alpha'), 1::bigint, 'other institutes untouched');

select * from finish();
rollback;
