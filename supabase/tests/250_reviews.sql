-- ADR-047: student reviews of the coaching; only owner/admin read them; a hidden name is never stored.
begin;
select tests.setup();
select * from no_plan();
create temp table b as select institute_id, name, id from public.batches;
grant select on b to authenticated;
create function pg_temp.bx(slug text) returns uuid language sql as $$
  select id from b where institute_id = tests.inst(slug) and name = 'Batch X' $$;

select tests.login('student1@alpha.test');
select lives_ok(format($$ insert into public.reviews (institute_id, batch_id, user_id, body)
  values (%L, %L, auth.uid(), 'Great physics classes') $$, tests.inst('alpha'), pg_temp.bx('alpha')),
  'student writes a named review for their batch');
select lives_ok(format($$ insert into public.reviews (institute_id, batch_id, body)
  values (%L, %L, 'Too much homework') $$, tests.inst('alpha'), pg_temp.bx('alpha')),
  'student writes an anonymous review (no user id)');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, user_id, body)
  values (%L, %L, %L, 'framed') $$, tests.inst('alpha'), pg_temp.bx('alpha'), tests.uid('student2@alpha.test')),
  '42501', null, 'cannot write under another student''s name');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, body) values (%L, %L, 'x') $$,
  tests.inst('alpha'), (select id from b where institute_id = tests.inst('alpha') and name = 'Batch Y')),
  '42501', null, 'cannot write about a batch they are not in');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, body) values (%L, %L, 'x') $$,
  tests.inst('bravo'), pg_temp.bx('bravo')), '42501', null, 'cannot write into another institute');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, body) values (%L, %L, '   ') $$,
  tests.inst('alpha'), pg_temp.bx('alpha')), '23514', null, 'blank review rejected');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, body) values (%L, %L, %L) $$,
  tests.inst('alpha'), pg_temp.bx('alpha'), repeat('a', 2001)), '23514', null, 'over 2000 characters rejected');
select is((select count(*) from public.reviews), 0::bigint, 'students do not read reviews, not even their own');
select throws_ok($$ update public.reviews set body = 'changed' $$, '42501', null, 'nor change them');

select tests.login('teacher1@alpha.test');
select is((select count(*) from public.reviews), 0::bigint, 'teachers never read reviews');
select throws_ok(format($$ insert into public.reviews (institute_id, batch_id, body) values (%L, %L, 'x') $$,
  tests.inst('alpha'), pg_temp.bx('alpha')), '42501', null, 'teachers cannot write reviews');

select tests.login('admin@alpha.test');
select is((select count(*) from public.reviews), 3::bigint, 'admin reads the two new reviews and the fixture one');
select tests.login('owner@alpha.test');
select results_eq($$ select body, user_id from public.reviews order by body $$,
  format($$ values ('Great physics classes', %L::uuid), ('Review of alpha', null), ('Too much homework', null) $$, tests.uid('student1@alpha.test')),
  'owner sees the named author and no author for the anonymous one');
select throws_ok($$ delete from public.reviews $$, '42501', null, 'owner cannot delete reviews');

select tests.login('owner@bravo.test');
select results_eq($$ select body from public.reviews $$, $$ values ('Review of bravo') $$,
  'another institute''s owner sees only their own');

select * from finish();
rollback;
