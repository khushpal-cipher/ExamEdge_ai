-- Renewal reminders: due only for paid institutes ending within 5 days, once per paid_until, never callable by users.
begin;
select tests.setup();
select * from no_plan();

update public.institutes set status = 'active', paid_until = (now() at time zone 'Asia/Kolkata')::date + 3
  where id = tests.inst('alpha');
update public.institutes set status = 'active', paid_until = (now() at time zone 'Asia/Kolkata')::date + 20
  where id = tests.inst('bravo');

select is((select count(*)::int from private.renewals_due() where institute_id = tests.inst('alpha')), 1,
  'alpha ends in 3 days: due');
select is((select count(*)::int from private.renewals_due() where institute_id = tests.inst('bravo')), 0,
  'bravo ends in 20 days: not due');
select ok((select 'owner@alpha.test' = any(owners) from private.renewals_due() where institute_id = tests.inst('alpha')),
  'the owner is the recipient');

select private.mark_reminded(tests.inst('alpha'), (now() at time zone 'Asia/Kolkata')::date + 3);
select is((select count(*)::int from private.renewals_due() where institute_id = tests.inst('alpha')), 0,
  'reminded once: not due again');
update public.institutes set paid_until = paid_until + 30 where id = tests.inst('alpha');
update public.institutes set paid_until = paid_until - 27 where id = tests.inst('alpha');
select is((select count(*)::int from private.renewals_due() where institute_id = tests.inst('alpha')), 0,
  'same paid_until value again: still reminded');

select tests.login('owner@alpha.test');
select throws_ok($$ select * from private.renewals_due() $$, '42501', null, 'an owner cannot call it');

select * from finish();
rollback;
