-- Platform admin sends a new owner invitation while the institute has no owner yet (ADR-036).
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

select tests.login('root@examedge.test', 'aal2');
select set_config('t.old', public.create_institute('gamma', 'Gamma', 'gamma.localhost', 'wrong@gamma.test'), true);
create temp table g as select id from public.institutes where slug = 'gamma';
grant select on g to authenticated;

-- ---------------------------------------------------------------- who may reinvite
select tests.login('owner@alpha.test');
select throws_ok(format($$ select public.reinvite_owner(%L, 'x@alpha.test') $$, tests.inst('alpha')), '42501', null,
  'an institute owner cannot call it');
select tests.login('root@examedge.test');
select throws_ok(format($$ select public.reinvite_owner(%L, 'right@gamma.test') $$, (select id from g)), '42501',
  null, 'platform admin without MFA cannot reinvite');

-- ---------------------------------------------------------------- guards
select tests.login('root@examedge.test', 'aal2');
select throws_ok(format($$ select public.reinvite_owner(%L, 'x@alpha.test') $$, tests.inst('alpha')), 'P0001',
  'has_owner', 'refused once an owner has joined');
select throws_ok($$ select public.reinvite_owner(gen_random_uuid(), 'x@x.test') $$, 'P0002', 'not_found',
  'unknown institute');
select throws_ok(format($$ select public.reinvite_owner(%L, 'not-an-email') $$, (select id from g)), '23514', null,
  'invalid email refused');

-- ---------------------------------------------------------------- reinvite
select set_config('t.new', public.reinvite_owner((select id from g), ' Right@Gamma.test '), true);
select isnt(current_setting('t.new'), current_setting('t.old'), 'a new token is returned');
select lives_ok(format($$ select public.reinvite_owner(%L, 'right@gamma.test') $$, (select id from g)),
  'sending again to the same email works (previous one is revoked first)');
select set_config('t.new', public.reinvite_owner((select id from g), 'right@gamma.test'), true);
reset role;
select is((select count(*) from public.invitations where institute_id = (select id from g)
  and accepted_at is null and revoked_at is null), 1::bigint, 'exactly one pending owner invitation');
select is((select email from public.invitations where institute_id = (select id from g) and revoked_at is null),
  'right@gamma.test', 'pending invitation has the new, normalised email');
select ok((select count(*) >= 2 from public.audit_events where action = 'invitations.update'
  and institute_id = (select id from g)), 'revocations are audited');

-- The old link is dead, the new one works for the right account only.
select tests.create_user('wrong@gamma.test');
select tests.login('wrong@gamma.test');
select throws_ok($$ select public.accept_invitation(current_setting('t.old')) $$, 'P0001', 'invitation_not_usable',
  'old owner link no longer works');
select throws_ok($$ select public.accept_invitation(current_setting('t.new')) $$, 'P0001', 'email_mismatch',
  'new link refuses the wrong account');
reset role;
select tests.create_user('right@gamma.test');
select tests.login('right@gamma.test');
select is(public.accept_invitation(current_setting('t.new')), (select id from g), 'new owner accepts');
select is((select role from public.memberships where institute_id = (select id from g)), 'owner',
  'they are the owner');

select tests.login('root@examedge.test', 'aal2');
select throws_ok(format($$ select public.reinvite_owner(%L, 'other@gamma.test') $$, (select id from g)), 'P0001',
  'has_owner', 'no further owner invitations after acceptance');

select * from finish();
rollback;
