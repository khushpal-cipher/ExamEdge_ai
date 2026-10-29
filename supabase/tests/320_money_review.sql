-- Batch D money review (migration 52): extras after a quarter without growth, period_start after an early renewal,
-- no top-up while read-only.
begin;
select tests.setup();
select plan(7);

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
create temp table d on commit drop as select (now() at time zone 'Asia/Kolkata')::date as today;
grant select on d to authenticated;
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;

-- ---------------------------------------------------------------- extras: a quiet quarter does not stop later ones
update public.institutes set status = 'active', billing_plan = 'yearly', covered_accounts = 6,
  extras_from = (select today - 200 from d), period_start = (select today - 200 from d),
  paid_until = (select today + 160 from d), price_list_id = private.newest_price_list() where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
insert into public.account_peaks values (tests.inst('alpha'), (select today - 60 from d), 40); -- 2nd quarter only
select tests.login('owner@alpha.test');
select results_eq($$ select accounts, period_start, base_paise from public.bill_quote(tests.inst('alpha'), 'extras') $$,
  $$ select 40, ((select today - 200 from d) + interval '3 months')::date, 499900::bigint $$,
  'the 2nd quarter''s growth is billed although the 1st quarter had none');

select tests.logout();
insert into public.account_peaks values (tests.inst('alpha'), (select today - 10 from d), 90); -- 3rd quarter, unfinished
select tests.login('owner@alpha.test');
select results_eq($$ select accounts from public.bill_quote(tests.inst('alpha'), 'extras') $$, $$ values (40) $$,
  'an unfinished quarter is not billed yet');

-- ---------------------------------------------------------------- monthly: early renewal moves period_start
select tests.logout();
update public.institutes set billing_plan = 'monthly', covered_accounts = null, extras_from = null,
  period_start = (select today - 25 from d), paid_until = (select today + 5 from d) where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
insert into public.account_peaks values (tests.inst('alpha'), (select today - 20 from d), 500);
select tests.login('owner@alpha.test');
select results_eq($$ select accounts from public.bill_quote(tests.inst('alpha'), 'monthly') $$, $$ values (500) $$,
  'the bill for next month counts this month''s peak');
insert into ids select 'm1', public.start_payment(tests.inst('alpha'), 'monthly');
select public.submit_utr((select v from ids where k = 'm1'), '111111111111');
select tests.login('root@examedge.test', 'aal2');
select public.approve_payment((select v from ids where k = 'm1'));
select results_eq($$ select period_start, paid_until from public.institutes where slug = 'alpha' $$,
  $$ select (select today + 6 from d), ((select today + 6 from d) + interval '1 month')::date - 1 $$,
  'period_start is the start of the newly paid month');
select tests.login('owner@alpha.test');
select results_eq($$ select accounts from public.bill_quote(tests.inst('alpha'), 'monthly') $$, $$ values (6) $$,
  'the month already paid for is not billed again');

-- ---------------------------------------------------------------- no top-up while read-only
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'topup')), 1::bigint, 'top-up while paid');
select tests.logout();
update public.institutes set paid_until = (select today - 2 from d) where slug = 'alpha';
select tests.login('owner@alpha.test');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'topup')), 0::bigint,
  'no top-up while read-only (AI is off)');

select * from finish();
rollback;
