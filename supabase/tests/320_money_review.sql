-- Batch D money review (migrations 52-53, LAUNCH_PLAN "Money review" M1-M7): monthly extras for the rest of the year,
-- read-only when extras stay unpaid, renewal only near the end, unpaid payments expire, period_start, top-ups.
begin;
select tests.setup();
select plan(21);

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
create temp table d on commit drop as select (now() at time zone 'Asia/Kolkata')::date as today;
grant select on d to authenticated;
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
update public.price_lists set min_accounts = 30, yearly_min_accounts = 1; -- written for a minimum of 30 and a free yearly floor

-- ---------------------------------------------------------------- M1, M6: extras month by month, rest of the year
-- A yearly plan for 6 accounts that started 200 days ago; 40 accounts in its 3rd month only.
update public.institutes set status = 'active', billing_plan = 'yearly', covered_accounts = 6,
  extras_from = (select today - 200 from d), period_start = (select today - 200 from d),
  paid_until = (select today + 160 from d), price_list_id = private.newest_price_list() where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
insert into public.account_peaks (institute_id, day, peak, last)
values (tests.inst('alpha'), ((select today - 200 from d) + interval '2 months 5 days')::date, 40, 6);
select tests.login('owner@alpha.test');
select results_eq($$ select accounts, period_start, base_paise from public.bill_quote(tests.inst('alpha'), 'extras') $$,
  $$ select 40, ((select today - 200 from d) + interval '2 months')::date, 1999900::bigint $$,
  'quiet months are skipped; 34 more accounts × 10 months left at the full ₹200 a month (₹20,000, charm ₹19,999)');

-- ---------------------------------------------------------------- M5: unpaid extras -> read-only after 7 days
select is(private.read_only(tests.inst('alpha')), true, 'extras unpaid more than 7 days after their month: read-only');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'extras')), 1::bigint,
  'the owner can still see and pay the extras bill');
select tests.logout();
update public.institutes set extras_from = ((select today - 3 from d) - interval '1 month')::date where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
insert into public.account_peaks (institute_id, day, peak, last)
values (tests.inst('alpha'), ((select today - 3 from d) - interval '1 month' + interval '5 days')::date, 40, 40);
select is(private.read_only(tests.inst('alpha')), false, 'a month that ended a few days ago: 7 days to pay');
select tests.login('owner@alpha.test');
insert into ids select 'e1', public.start_payment(tests.inst('alpha'), 'extras');
select lives_ok($$ select public.submit_utr((select v from ids where k = 'e1'), '222222222221') $$, 'owner pays extras');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.approve_payment((select v from ids where k = 'e1')) $$, 'approved');
select results_eq($$ select covered_accounts from public.institutes where slug = 'alpha' $$, $$ values (40) $$,
  'the covered count rises to 40');
select throws_ok($$ select * from private.extras_due(tests.inst('alpha')) $$, '42501', null,
  'extras_due is internal: no API user may call it');
select tests.logout();
select is((select count(*) from private.extras_due(tests.inst('alpha'))), 0::bigint,
  'the 40 carried into the next month are covered: nothing more to pay');

-- the count carried in from before a month counts in that month, below the 30 minimum costs nothing
update public.institutes set covered_accounts = 6, extras_from = (select today - 100 from d) where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
insert into public.account_peaks (institute_id, day, peak, last) values (tests.inst('alpha'), (select today - 105 from d), 50, 50);
select is((select accounts from private.extras_due(tests.inst('alpha'))), 50,
  'accounts added just before a month are counted in that month');
update public.account_peaks set peak = 20, last = 20 where institute_id = tests.inst('alpha');
select is((select count(*) from private.extras_due(tests.inst('alpha'))), 0::bigint,
  'growing from 6 to 20 costs nothing (still under the 30-account minimum)');

-- ---------------------------------------------------------------- M4: renewal only in the last 7 days
update public.institutes set billing_plan = 'monthly', covered_accounts = null, extras_from = null,
  period_start = (select today - 20 from d), paid_until = (select today + 7 from d) where slug = 'alpha';
delete from public.account_peaks where institute_id = tests.inst('alpha');
select tests.login('owner@alpha.test');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'monthly')), 0::bigint,
  '8 paid days left: no renewal yet');
select tests.logout();
update public.institutes set paid_until = (select today + 6 from d) where slug = 'alpha';
select tests.login('owner@alpha.test');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'monthly')), 1::bigint,
  '7 paid days left: renewal opens');

-- ---------------------------------------------------------------- M2: period_start moves on an early renewal
select tests.logout();
insert into public.account_peaks (institute_id, day, peak, last) values (tests.inst('alpha'), (select today - 10 from d), 500, 6);
select tests.login('owner@alpha.test');
select results_eq($$ select accounts from public.bill_quote(tests.inst('alpha'), 'monthly') $$, $$ values (500) $$,
  'the bill for next month counts this month''s peak');
insert into ids select 'm1', public.start_payment(tests.inst('alpha'), 'monthly');
select public.submit_utr((select v from ids where k = 'm1'), '111111111111');
select tests.login('root@examedge.test', 'aal2');
select public.approve_payment((select v from ids where k = 'm1'));
select results_eq($$ select period_start from public.institutes where slug = 'alpha' $$, $$ select today + 7 from d $$,
  'period_start is the start of the newly paid month');
select tests.logout();
select is(private.peak_between(tests.inst('alpha'), (select today + 7 from d), (select today + 40 from d)), 6,
  'the month already paid for (500) is not billed again');

-- ---------------------------------------------------------------- M7: an unpaid payment lasts 24 hours
update public.institutes set paid_until = (select today + 3 from d) where slug = 'alpha';
select tests.login('owner@alpha.test');
insert into ids select 'old', public.start_payment(tests.inst('alpha'), 'monthly');
select tests.logout();
update public.payments set created_at = now() - interval '25 hours' where id = (select v from ids where k = 'old');
insert into public.memberships (institute_id, user_id, role)
select tests.inst('alpha'), tests.create_user('grow' || g || '@alpha.test'), 'student' from generate_series(1, 100) g;
select tests.login('owner@alpha.test');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'old'), '333333333331') $$, 'P0001',
  'payment_expired', 'a UTR for an unpaid payment older than 24 hours is refused');
insert into ids select 'new', public.start_payment(tests.inst('alpha'), 'monthly');
select isnt((select v from ids where k = 'new'), (select v from ids where k = 'old'), 'Pay makes a fresh payment');
select results_eq($$ select accounts from public.payments where id = (select v from ids where k = 'new') $$,
  $$ values (106) $$, 'at today''s count');

-- ---------------------------------------------------------------- M3: no top-up while read-only
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'topup')), 1::bigint, 'top-up while paid');
select tests.logout();
update public.institutes set paid_until = (select today - 2 from d) where slug = 'alpha';
select tests.login('owner@alpha.test');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'topup')), 0::bigint,
  'no top-up while read-only (AI is off)');

select * from finish();
rollback;
