-- The automatic ₹ per US$ rate: the worker saves a sane rate, a wild one is refused, users cannot call it.
begin;
select tests.setup();
select * from no_plan();

select is(private.auto_inr_per_usd(94.954), true, 'a sane rate is saved');
select is(private.inr_per_usd(), 94.95::numeric, 'rounded to 2 decimals');
select is(private.auto_inr_per_usd(9.4), false, 'a rate below 50 is refused');
select is(private.auto_inr_per_usd(950), false, 'a rate above 200 is refused');
select is(private.auto_inr_per_usd(null), false, 'no rate is refused');
select is(private.inr_per_usd(), 94.95::numeric, 'the refused rates changed nothing');
select is((select count(*)::int from public.audit_events where action = 'platform.inr_per_usd_auto'), 1,
  'one audit line, for the saved rate only');

select tests.login('owner@alpha.test');
select throws_ok($$ select private.auto_inr_per_usd(90) $$, '42501', null, 'an owner cannot call it');

select * from finish();
rollback;
