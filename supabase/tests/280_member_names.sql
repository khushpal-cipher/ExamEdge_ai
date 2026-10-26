-- Founder change A: invited names fill an empty profile name; staff set names within their own reach.
begin;
select tests.setup();
select * from no_plan();

create temp table m on commit drop as
  select u.email, ms.id from public.memberships ms join auth.users u on u.id = ms.user_id;
grant select on m to authenticated;

-- invitation with a name -> the name lands in the empty profile on accept
select tests.login('owner@alpha.test');
select set_config('t.token', public.create_invitation(tests.inst('alpha'), 'named@alpha.test', 'student', null, '  Riya Sharma '), true);
select tests.logout();
select tests.create_user('named@alpha.test');
update public.profiles set full_name = null where user_id = tests.uid('named@alpha.test'); -- email sign-in has no name
select tests.login('named@alpha.test');
select public.accept_invitation(current_setting('t.token'));
select is((select full_name from public.profiles where user_id = auth.uid()), 'Riya Sharma', 'invited name fills an empty profile');
select tests.logout();

-- a name the person already has is kept
select tests.login('owner@alpha.test');
select set_config('t.token', public.create_invitation(tests.inst('alpha'), 'student3@alpha.test', 'student', null, 'Other Name'), true);
select tests.logout();

-- owner/admin rename students and teachers, never owner/admin
select tests.login('admin@alpha.test');
select lives_ok(format($$ select public.set_member_name(%L, 'Asha Rao') $$, (select id from pg_temp.m where email = 'student1@alpha.test')),
  'admin renames a student');
select is((select full_name from public.profiles where user_id = tests.uid('student1@alpha.test')), 'Asha Rao', 'name saved');
select throws_ok(format($$ select public.set_member_name(%L, 'x') $$, (select id from pg_temp.m where email = 'owner@alpha.test')),
  '42501', null, 'admin cannot rename the owner');
select throws_ok(format($$ select public.set_member_name(%L, '   ') $$, (select id from pg_temp.m where email = 'student1@alpha.test')),
  'P0001', 'name_invalid', 'empty name refused');

-- teacher: own batch students only
select tests.login('teacher1@alpha.test');
select lives_ok(format($$ select public.set_member_name(%L, 'Asha R') $$, (select id from pg_temp.m where email = 'student2@alpha.test')),
  'teacher renames a student of their batch');
select throws_ok(format($$ select public.set_member_name(%L, 'x') $$, (select id from pg_temp.m where email = 'student3@alpha.test')),
  '42501', null, 'teacher cannot rename a student of another batch');
select throws_ok(format($$ select public.set_member_name(%L, 'x') $$, (select id from pg_temp.m where email = 'teacher2@alpha.test')),
  '42501', null, 'teacher cannot rename a teacher');

-- student and other institute
select tests.login('student1@alpha.test');
select throws_ok(format($$ select public.set_member_name(%L, 'x') $$, (select id from pg_temp.m where email = 'student2@alpha.test')),
  '42501', null, 'student cannot rename others');
select tests.login('owner@bravo.test');
select throws_ok(format($$ select public.set_member_name(%L, 'x') $$, (select id from pg_temp.m where email = 'student1@alpha.test')),
  '42501', null, 'another institute cannot rename');

select * from finish();
rollback;
