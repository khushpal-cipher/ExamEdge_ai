-- ADR-047: student reviews of the coaching; only owner/admin read and reply; a hidden name is never stored; the
-- student reads replies to their named reviews.
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
select is((select count(*) from public.reviews), 0::bigint, 'a student reads no review rows directly');
select results_eq(format($$ select body, anonymous from public.my_reviews(%L) order by body $$, tests.inst('alpha')),
  $$ values ('Great physics classes', false), ('Too much homework', true) $$,
  'my_reviews: both own reviews, the anonymous one included');
select throws_ok($$ select * from private.review_authors $$, '42501', null, 'the author table is not readable');
select throws_ok($$ update public.reviews set body = 'changed' $$, '42501', null, 'nor change them');
select is(tests.affected($$ update public.reviews set reply = 'self reply' where true $$), 0::bigint,
  'a student cannot reply');

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
select throws_ok($$ update public.reviews set body = 'edited' $$, '42501', null, 'owner cannot edit what a student wrote');
select throws_ok(format($$ update public.reviews set replied_by = %L $$, tests.uid('admin@alpha.test')), '42501', null,
  'nor set who replied');
select is(tests.affected($$ update public.reviews set reply = 'Thanks, we will add doubt classes' where body like 'Great%' $$),
  1::bigint, 'owner replies');
select is(tests.affected($$ update public.reviews set reply = 'Noted' where body like 'Too much%' $$), 1::bigint,
  'owner can reply to an anonymous review too');
select results_eq($$ select replied_by, replied_at is not null from public.reviews where body like 'Great%' $$,
  format($$ values (%L::uuid, true) $$, tests.uid('owner@alpha.test')), 'who and when are stamped by the database');
select throws_ok($$ update public.reviews set reply = '' where body like 'Great%' $$, '23514', null, 'empty reply rejected');

select is((select count(*) from public.my_reviews(tests.inst('alpha'))), 0::bigint, 'owner''s my_reviews: none of the students''');
select throws_ok($$ select user_id from private.review_authors $$, '42501', null, 'owner cannot look up an anonymous author');
select is((select user_id from public.reviews where body like 'Too much%'), null, 'and the review row has no author');

select tests.login('student1@alpha.test');
select results_eq(format($$ select body, reply from public.my_reviews(%L) order by body $$, tests.inst('alpha')),
  $$ values ('Great physics classes', 'Thanks, we will add doubt classes'), ('Too much homework', 'Noted') $$,
  'the student reads the replies, also to their anonymous review');
select tests.login('student2@alpha.test');
select is((select count(*) from public.my_reviews(tests.inst('alpha'))), 0::bigint, 'another student sees none of them');
select tests.login('teacher1@alpha.test');
select is(tests.affected($$ update public.reviews set reply = 'teacher' where true $$), 0::bigint, 'a teacher cannot reply');
select tests.login('owner@alpha.test');
select lives_ok($$ update public.reviews set reply = null where body like 'Great%' $$, 'owner removes a reply');
select results_eq($$ select replied_by, replied_at from public.reviews where body like 'Great%' $$,
  $$ values (null::uuid, null::timestamptz) $$, 'removing a reply clears who and when');

select tests.login('owner@bravo.test');
select results_eq($$ select body from public.reviews $$, $$ values ('Review of bravo') $$,
  'another institute''s owner sees only their own');

select * from finish();
rollback;
