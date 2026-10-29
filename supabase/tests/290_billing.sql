-- LAUNCH_PLAN steps 3-9: price slabs, account counts and peaks, limits that follow the count, UPI payments checked by
-- hand (start, UTR, approve, reject), read-only after paid_until + 3 days, top-ups, staff daily cap.
begin;
select tests.setup();
select * from no_plan();

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
create temp table d on commit drop as select (now() at time zone 'Asia/Kolkata')::date as today;
grant select on d to authenticated, worker;
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
grant usage on schema tests to worker;

-- ---------------------------------------------------------------- price slabs (rule 2)
create temp table pl on commit drop as select private.newest_price_list() as id;
select is((select private.price(10, id) from pl), 600000::bigint, 'below the minimum of 30 accounts: ₹6,000');
select is((select private.price(100, id) from pl), 2000000::bigint, '100 accounts: ₹20,000');
select is((select private.price(301, id) from pl), 6012000::bigint, '301 accounts: ₹60,120 (slabs)');
select is((select private.price(1000, id) from pl), 14400000::bigint, '1,000 accounts: ₹1,44,000');
select is((select private.price(1001, id) from pl), 14408900::bigint, '1,001st account at ₹89');

-- ---------------------------------------------------------------- who is counted and the daily peak
select is(private.account_count(tests.inst('alpha')), 6, 'admin, 2 teachers and 3 students count; the owner is free');
select is((select peak from public.account_peaks where institute_id = tests.inst('alpha') and day = (select today from d)),
  6, 'today''s peak was recorded');
update public.memberships set status = 'suspended' where user_id = tests.uid('student3@alpha.test');
select is(private.account_count(tests.inst('alpha')), 5, 'a suspended account is not counted');
select is((select peak from public.account_peaks where institute_id = tests.inst('alpha') and day = (select today from d)),
  6, 'but the peak of the day stays');
update public.memberships set status = 'active' where user_id = tests.uid('student3@alpha.test');

-- ---------------------------------------------------------------- start a payment (rule 7)
select tests.login('admin@alpha.test');
select throws_ok($$ select public.start_payment(tests.inst('alpha'), 'monthly') $$, '42501', 'only the owner can pay',
  'an admin cannot start a payment');
select tests.login('student1@alpha.test');
select throws_ok($$ select public.billing_status(tests.inst('alpha')) $$, '42501', 'not allowed', 'a student sees no bill');
select tests.login('owner@bravo.test');
select throws_ok($$ select public.billing_status(tests.inst('alpha')) $$, '42501', 'not allowed',
  'another institute''s owner sees no bill');

select tests.login('owner@alpha.test');
select results_eq($$ select accounts, total_paise from public.bill_quote(tests.inst('alpha'), 'monthly') $$,
  $$ values (6, 600000::bigint) $$, 'the monthly quote is the minimum 30 accounts, no GST without a GST number');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'topup')), 0::bigint, 'no top-up for a pilot');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'extras')), 0::bigint, 'no extras without a year');
insert into ids select 'p1', public.start_payment(tests.inst('alpha'), 'monthly');
select is(public.start_payment(tests.inst('alpha'), 'monthly'), (select v from ids where k = 'p1'),
  'starting again before the UTR gives the same payment');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'p1'), '12345') $$, 'P0001', 'utr_invalid',
  'a UTR has 12 digits');

-- GST appears only once the platform has a GST number, and does not change a waiting amount
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.set_gst_number('27ABCDE1234F1Z5') $$, 'the platform admin saves a GST number');
select tests.login('owner@alpha.test');
select is(public.start_payment(tests.inst('alpha'), 'monthly'), (select v from ids where k = 'p1'), 'same waiting row');
select is((select total_paise from public.payments where id = (select v from ids where k = 'p1')), 600000::bigint,
  'the waiting amount did not change');
select results_eq($$ select base_paise, gst_paise, total_paise from public.bill_quote(tests.inst('alpha'), 'yearly') $$,
  $$ values (6000000::bigint, 1080000::bigint, 7080000::bigint) $$, 'a new yearly quote: 10 months + 18% GST');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.set_gst_number('') $$, 'and clears it again');
select tests.login('owner@alpha.test');

select lives_ok($$ select public.submit_utr((select v from ids where k = 'p1'), ' 123456789012 ') $$, 'the owner types the UTR');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'p1'), '123456789013') $$, 'P0001',
  'not_available', 'it cannot be changed');
select throws_ok($$ select public.start_payment(tests.inst('alpha'), 'yearly') $$, 'P0001', 'payment_waiting',
  'one payment with a UTR waits at a time');
select throws_ok($$ update public.payments set status = 'approved' $$, '42501', null, 'the owner cannot approve');
select tests.login('owner@bravo.test');
insert into ids select 'b1', public.start_payment(tests.inst('bravo'), 'monthly');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'b1'), '123456789012') $$, 'P0001', 'utr_used',
  'the same UTR cannot be used twice');
select is((select count(*) from public.payments where reject_reason is distinct from 'fixture'), 1::bigint, 'bravo''s owner sees only its own payment');
select tests.login('owner@alpha.test');
select is((select count(*) from public.payments where reject_reason is distinct from 'fixture'), 1::bigint, 'alpha''s owner sees its own payment');

-- ---------------------------------------------------------------- a waiting payment gives no extra access
select tests.logout();
update public.institutes set status = 'active', paid_until = (select today - 5 from d), period_start = (select today - 35 from d)
where slug = 'alpha';
select is(private.read_only(tests.inst('alpha')), true, 'unpaid and past the grace days: read-only');
select tests.login('owner@alpha.test');
select is((select read_only from public.billing_status(tests.inst('alpha'))), true,
  'a waiting UTR does not lift read-only (founder: access only after Approve)');
select throws_ok($$ update public.batches set name = 'Late' where name = 'Batch X' $$, 'P0001', 'read_only', 'owner cannot write');

-- grace: read-only starts at midnight after paid_until + 3 days
select tests.logout();
update public.institutes set paid_until = (select today - 3 from d) where slug = 'alpha';
select is(private.read_only(tests.inst('alpha')), false, 'within 3 days'' grace: not read-only');
update public.institutes set paid_until = (select today - 4 from d) where slug = 'alpha';
select is(private.read_only(tests.inst('alpha')), true, 'a day later: read-only');

-- ---------------------------------------------------------------- approve and reject (aal2 only)
select tests.login('owner@alpha.test');
select throws_ok($$ select public.approve_payment((select v from ids where k = 'p1')) $$, '42501', null,
  'the owner cannot approve');
select tests.login('root@examedge.test', 'aal1');
select throws_ok($$ select public.approve_payment((select v from ids where k = 'p1')) $$, '42501', null,
  'a platform admin without MFA cannot approve');
select tests.login('root@examedge.test', 'aal2');
select is((select count(*) from public.payments where reject_reason is distinct from 'fixture'
  and institute_id in (tests.inst('alpha'), tests.inst('bravo'))), 2::bigint, 'the platform admin sees every payment');
select throws_ok($$ select public.approve_payment((select v from ids where k = 'b1')) $$, 'P0001', 'not_available',
  'a payment without a UTR cannot be approved');
select throws_ok($$ select public.reject_payment((select v from ids where k = 'b1'), '  ') $$, 'P0001', 'reason_required',
  'a rejection needs a reason');
select lives_ok($$ select public.approve_payment((select v from ids where k = 'p1')) $$, 'approve');
select results_eq($$ select status, period_start, period_end, receipt_no like 'EE-____-_____' from public.payments
  where id = (select v from ids where k = 'p1') $$,
  $$ select 'approved'::text, (select today from d), ((select today from d) + interval '1 month')::date - 1, true $$,
  'approved: receipt number, a month from today (the old period had ended)');
select results_eq($$ select status, paid_until, billing_plan from public.institutes where slug = 'alpha' $$,
  $$ select 'active'::text, ((select today from d) + interval '1 month')::date - 1, 'monthly'::text $$,
  'paid_until set');
select is(private.read_only(tests.inst('alpha')), false, 'access is back');
select throws_ok($$ select public.approve_payment((select v from ids where k = 'p1')) $$, 'P0001', 'not_available',
  'a payment is decided once');
select is((select count(*) from public.audit_events where action = 'billing.payment_approved'), 1::bigint, 'audited');

-- ---------------------------------------------------------------- limits follow the count (rule 9)
select results_eq($$ select monthly_ai_budget_micro_usd, max_storage_bytes, student_daily_messages,
  student_daily_generations, staff_daily_requests, max_students, hard_stop
  from public.institute_quotas where institute_id = tests.inst('alpha') $$,
  $$ values (49000000::bigint, 5368709120::bigint, 15, 5, 30, null::int, true) $$,
  '30 accounts: $18 + $31 of AI, 5 GB, 15 doubts and 5 study tools, 30 staff requests, no seat cap');
select tests.logout();
insert into public.memberships (institute_id, user_id, role)
select tests.inst('alpha'), tests.create_user('bulk' || g || '@alpha.test'), 'student' from generate_series(1, 300) g;
select is(private.account_count(tests.inst('alpha')), 306, 'the count grew');
select results_eq($$ select monthly_ai_budget_micro_usd, max_storage_bytes, max_concurrent_jobs
  from public.institute_quotas where institute_id = tests.inst('alpha') $$,
  $$ values (306 * 600000::bigint + 31000000, 7::bigint * 1073741824, 2) $$,
  'the AI budget and storage follow the count at once, not on the 1st');
select tests.login('root@examedge.test', 'aal2');
select results_eq($$ select accounts, total_paise from public.bill_quote(tests.inst('alpha'), 'monthly') $$,
  $$ values (306, 6012000::bigint + 5 * 12000) $$, 'next month''s bill uses the highest count (306: 300 × ₹200 + 6 × ₹120)');

select tests.logout();
delete from public.memberships where user_id in (select id from auth.users where email like 'bulk%@alpha.test');
select tests.login('root@examedge.test', 'aal2');
select results_eq($$ select accounts from public.bill_quote(tests.inst('alpha'), 'monthly') $$, $$ values (306) $$,
  'removing them again: the bill still uses the highest count of the period (306), as the founder asked');

-- ---------------------------------------------------------------- top-up (step 9)
select tests.login('owner@alpha.test');
select results_eq($$ select accounts, total_paise from public.bill_quote(tests.inst('alpha'), 'topup') $$,
  $$ values (null::int, 250000::bigint) $$, 'a top-up is ₹2,500');
select results_eq($$ select ai_budget_micro, accounts from public.billing_status(tests.inst('alpha')) $$,
  $$ select monthly_ai_budget_micro_usd, 6 from public.institute_quotas where institute_id = tests.inst('alpha') $$,
  'the Bill page budget before the top-up');
insert into ids select 't1', public.start_payment(tests.inst('alpha'), 'topup');
select lives_ok($$ select public.submit_utr((select v from ids where k = 't1'), '999999999991') $$, 'owner pays');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.approve_payment((select v from ids where k = 't1')) $$, 'approved');
select tests.login('owner@alpha.test');
select is((select ai_budget_micro from public.billing_status(tests.inst('alpha'))),
  (select monthly_ai_budget_micro_usd + 20000000 from public.institute_quotas where institute_id = tests.inst('alpha')),
  'the month''s AI budget grew by $20');
select tests.logout();
update public.institute_quotas set monthly_ai_budget_micro_usd = 1000 where institute_id = tests.inst('alpha');
select tests.login('student1@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'tutor', 'fake', 'fake', 10)), null,
  'with the top-up the AI still answers when the base budget is spent');

-- ---------------------------------------------------------------- staff daily cap (founder answer 4)
select tests.logout();
update public.institute_quotas set staff_daily_requests = 1, monthly_ai_budget_micro_usd = 100000000
where institute_id = tests.inst('alpha');
select tests.login('teacher1@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'question_gen', 'fake', 'fake', 10)), null,
  'a teacher''s first AI request of the day works');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'question_gen', 'fake', 'fake', 10)), 'quota',
  'the next one hits the staff daily cap');
select tests.login('teacher2@alpha.test');
select is((select blocked from public.ai_reserve(tests.inst('alpha'), 'question_gen', 'fake', 'fake', 10)), null,
  'another teacher has their own count');

-- ---------------------------------------------------------------- yearly, early payment, extras (rules 5, 6)
select tests.logout();
update public.institutes set paid_until = (select today + 10 from d), period_start = (select today - 20 from d)
where slug = 'alpha';
select tests.login('owner@alpha.test');
select results_eq($$ select base_paise from public.bill_quote(tests.inst('alpha'), 'yearly') $$,
  $$ values (private.price(6, private.newest_price_list()) * 10) $$, 'yearly = 10 months at the count today');
insert into ids select 'y1', public.start_payment(tests.inst('alpha'), 'yearly');
select lives_ok($$ select public.submit_utr((select v from ids where k = 'y1'), '999999999992') $$, 'owner pays yearly');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.approve_payment((select v from ids where k = 'y1')) $$, 'approved');
select results_eq($$ select y.period_start, i.paid_until, i.billing_plan, i.covered_accounts from public.payments y
  join public.institutes i on i.id = y.institute_id where y.id = (select v from ids where k = 'y1') $$,
  $$ select (select today + 11 from d), ((select today + 11 from d) + interval '12 months')::date - 1,
     'yearly'::text, 6 $$, 'paying early extends from the old end: no paid day is lost');
select is((select count(*) from public.bill_quote(tests.inst('alpha'), 'extras')), 0::bigint,
  'no extras before the first quarter is over');
select tests.logout();
update public.institutes set extras_from = (select today - 100 from d), paid_until = (select today + 200 from d)
where slug = 'alpha';
insert into public.account_peaks (institute_id, day, peak) values (tests.inst('alpha'), (select today - 50 from d), 40);
select tests.login('owner@alpha.test');
select results_eq($$ select accounts, base_paise from public.bill_quote(tests.inst('alpha'), 'extras') $$,
  $$ values (40, 500000::bigint) $$,
  'extras: 3 months of the price difference (₹8,000 - ₹6,000) at 10/12 = ₹5,000');
insert into ids select 'e1', public.start_payment(tests.inst('alpha'), 'extras');
select lives_ok($$ select public.submit_utr((select v from ids where k = 'e1'), '999999999993') $$, 'owner pays extras');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.approve_payment((select v from ids where k = 'e1')) $$, 'approved');
select results_eq($$ select covered_accounts, extras_from > (select today - 10 from d) from public.institutes where slug = 'alpha' $$,
  $$ values (40, true) $$, 'the covered count rises and the quarter is closed');

-- ---------------------------------------------------------------- one unpaid payment at a time
select tests.login('owner@alpha.test');
select lives_ok($$ select public.start_payment(tests.inst('alpha'), 'topup') $$, 'owner starts a top-up');
select lives_ok($$ select public.start_payment(tests.inst('alpha'), 'monthly') $$, 'then a monthly payment');
select results_eq($$ select kind from public.payments where status = 'waiting' and utr is null
  and institute_id = tests.inst('alpha') $$,
  $$ values ('monthly'::text) $$, 'only the newest unpaid payment is left');
select tests.login('root@examedge.test', 'aal2');

-- ---------------------------------------------------------------- rejection, price list change
select lives_ok($$ select public.reject_payment((select v from ids where k = 'b1'), 'No such payment in the bank') $$,
  'rejecting needs only a reason');
select tests.login('owner@bravo.test');
select results_eq($$ select status, reject_reason from public.payments where reject_reason is distinct from 'fixture' $$,
  $$ values ('rejected'::text, 'No such payment in the bank'::text) $$, 'the owner sees why');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'b1'), '888888888888') $$, 'P0001',
  'not_available', 'a rejected payment is closed');
select throws_ok($$ select public.add_price_list(30, 300, 1, 1000, 1, 1, 10, 1, 1) $$, '42501', null,
  'only the platform admin adds a price list');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.add_price_list(30, 300, 25000, 1000, 15000, 10000, 10, 300000, 20000000) $$,
  'the platform admin adds a price list');
select is((select private.price(100, private.newest_price_list())), 2500000::bigint, 'the next quote uses the newest list');
select is((select private.price(100, i.price_list_id) from public.institutes i where slug = 'alpha'), 2000000::bigint,
  'alpha keeps the list of its paid period until it pays again');

select * from finish();
rollback;
