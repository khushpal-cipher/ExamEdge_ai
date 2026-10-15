-- T-SEC-18 / AC2.3 / AC2.4: invitations are the only way into an institute, single-use, email-bound.
begin;
select tests.setup();
select * from no_plan();

-- AC2.3: signing in (a new auth user) creates a profile but never a membership.
select tests.create_user('stranger@gmail.test');
select is((select count(*) from public.memberships where user_id = tests.uid('stranger@gmail.test')), 0::bigint,
  'Google login alone creates no membership (AC2.3)');
select is((select count(*) from public.profiles where user_id = tests.uid('stranger@gmail.test')), 1::bigint,
  'profile created on sign-up');
select tests.login('stranger@gmail.test');
select is((select count(*) from public.institutes), 0::bigint, 'signed-in stranger sees no institute');

-- Correct acceptance succeeds exactly once (invitation for new@alpha.test, batch X, token tok-alpha).
select throws_ok($$ select public.accept_invitation('tok-alpha') $$, 'P0001', 'email_mismatch',
  'wrong Google account cannot accept');
select tests.logout();
select tests.create_user('New@Alpha.test');
select tests.login('New@Alpha.test');
select is(public.accept_invitation('tok-alpha'), tests.inst('alpha'), 'invited email accepts (case-insensitive)');
select is((select role from public.memberships), 'student', 'membership created with invited role');
select is((select count(*) from public.batch_members), 1::bigint, 'enrolled in the invited batch');
select is((select name from public.subjects), 'Physics', 'new student sees own batch subjects');
select throws_ok($$ select public.accept_invitation('tok-alpha') $$, 'P0001', 'invitation_not_usable',
  'token cannot be reused');

-- Invalid, expired, revoked, unverified, anonymous.
select throws_ok($$ select public.accept_invitation('nope') $$, 'P0001', 'invitation_invalid', 'unknown token rejected');
select tests.logout();
insert into public.invitations (institute_id, email, role, token_hash, expires_at)
values (tests.inst('alpha'), 'late@alpha.test', 'student', sha256(convert_to('tok-expired', 'UTF8')), now() - interval '1 minute');
select tests.create_user('late@alpha.test');
select tests.login('late@alpha.test');
select throws_ok($$ select public.accept_invitation('tok-expired') $$, 'P0001', 'invitation_not_usable',
  'expired token rejected');

select tests.login('owner@alpha.test');
select set_config('t.token', public.create_invitation(tests.inst('alpha'), 'revoked@alpha.test', 'teacher'), true);
select is(tests.affected($$ update public.invitations set revoked_at = now() where email = 'revoked@alpha.test' $$),
  1::bigint, 'owner revokes an invitation');
select tests.logout();
select tests.create_user('revoked@alpha.test');
select tests.login('revoked@alpha.test');
select throws_ok(format($$ select public.accept_invitation(%L) $$, current_setting('t.token')), 'P0001',
  'invitation_not_usable', 'revoked token rejected');

select tests.login('owner@alpha.test');
select set_config('t.token', public.create_invitation(tests.inst('alpha'), 'unverified@alpha.test', 'student'), true);
select tests.logout();
select tests.create_user('unverified@alpha.test');
update auth.users set email_confirmed_at = null where email = 'unverified@alpha.test';
select tests.login('unverified@alpha.test');
select throws_ok(format($$ select public.accept_invitation(%L) $$, current_setting('t.token')), 'P0001',
  'email_mismatch', 'unverified email cannot accept');

select tests.as_anon();
select throws_ok($$ select public.accept_invitation('tok-bravo') $$, '42501', null, 'anonymous caller cannot accept');

-- Existing members, re-invites, audit.
select tests.login('owner@alpha.test');
select set_config('t.token', public.create_invitation(tests.inst('alpha'), 'student1@alpha.test', 'teacher'), true);
select tests.login('student1@alpha.test');
select throws_ok(format($$ select public.accept_invitation(%L) $$, current_setting('t.token')), 'P0001',
  'already_member', 'existing member cannot use an invitation to change role');

select tests.login('owner@alpha.test');
select public.create_invitation(tests.inst('alpha'), 'twice@alpha.test', 'student');
select public.create_invitation(tests.inst('alpha'), 'TWICE@alpha.test', 'student');
select is((select count(*) from public.invitations where email = 'twice@alpha.test' and revoked_at is null), 1::bigint,
  're-inviting revokes the previous pending invitation');
select tests.logout();
select ok(exists (select 1 from public.audit_events where action = 'invitations.update'
  and (metadata -> 'new' ->> 'accepted_by')::uuid = tests.uid('New@Alpha.test')), 'acceptance audited');
select ok(exists (select 1 from public.audit_events where action = 'memberships.insert'
  and actor_user_id = tests.uid('New@Alpha.test')), 'membership creation audited');

select * from finish();
rollback;
