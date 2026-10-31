-- Razorpay (ADR-062, T-SEC-13): the database checks the webhook signature, acts once per event id, approves only an
-- order.paid whose receipt is a waiting payment and whose amount matches; the owner's Checkout id never approves.
begin;
select tests.setup();
select plan(28);

insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;
-- signed webhook bodies, built as the superuser with the secret below
create temp table hook (k text primary key, body text, sig text);
grant select on hook to anon, authenticated;
create function pg_temp.sign(k text, body text) returns void language sql as $$
  insert into hook values (k, body, encode(extensions.hmac(convert_to(body, 'UTF8'), convert_to('whsec-test-123', 'UTF8'), 'sha256'), 'hex')) $$;
create function pg_temp.paid(pay uuid, amount bigint) returns text language sql as $$
  select jsonb_build_object('event', 'order.paid', 'payload', jsonb_build_object(
    'payment', jsonb_build_object('entity', jsonb_build_object('id', 'pay_TestPay0000001', 'amount', amount, 'currency', 'INR')),
    'order', jsonb_build_object('entity', jsonb_build_object('id', 'order_TestOrd000001', 'amount', amount,
      'amount_paid', amount, 'currency', 'INR', 'receipt', pay::text, 'status', 'paid'))))::text $$;

-- ---------------------------------------------------------------- the secret
set local role anon;
select throws_ok($$ select public.razorpay_webhook('{}', 'x', 'evt_0') $$, 'P0001', 'not_configured',
  'no webhook secret yet: nothing is accepted');
select tests.login('owner@alpha.test');
select throws_ok($$ select public.set_razorpay_secret('whsec-test-123') $$, '42501', null, 'an owner cannot set the secret');
select is(public.razorpay_ready(), null, 'an owner cannot even see whether it is set');
select tests.login('root@examedge.test');
select throws_ok($$ select public.set_razorpay_secret('whsec-test-123') $$, '42501', null, 'a platform admin needs MFA');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.set_razorpay_secret('whsec-test-123') $$, 'a platform admin with MFA sets it');
select is(public.razorpay_ready(), true, 'the platform page sees "set"');
select throws_ok($$ select razorpay_webhook_secret from private.settings $$, '42501', null,
  'the secret is never readable through the API');

-- ---------------------------------------------------------------- internal parts are closed
select tests.logout();
set local role anon;
select throws_ok($$ select * from private.payment_events $$, '42501', null, 'anon cannot read webhook events');
select tests.login('owner@alpha.test');
select throws_ok($$ select private.approve_core(gen_random_uuid(), 'system') $$, '42501', null,
  'the internal approve is not callable by users');

-- ---------------------------------------------------------------- webhook on alpha's monthly payment
insert into ids select 'a1', public.start_payment(tests.inst('alpha'), 'monthly');
select tests.logout();
select pg_temp.sign('captured', '{"event":"payment.captured","payload":{}}');
select pg_temp.sign('short', pg_temp.paid((select v from ids where k = 'a1'),
  (select total_paise - 100 from public.payments where id = (select v from ids where k = 'a1'))));
select pg_temp.sign('good', pg_temp.paid((select v from ids where k = 'a1'),
  (select total_paise from public.payments where id = (select v from ids where k = 'a1'))));
select pg_temp.sign('stranger', pg_temp.paid(gen_random_uuid(), 100));
set local role anon;
select throws_ok($$ select public.razorpay_webhook((select body from hook where k = 'good'), repeat('0', 64), 'evt_1') $$,
  '42501', 'bad_signature', 'a wrong signature is refused');
select throws_ok($$ select public.razorpay_webhook((select body from hook where k = 'good') || ' ',
  (select sig from hook where k = 'good'), 'evt_1') $$, '42501', 'bad_signature', 'a changed body is refused');
select is(public.razorpay_webhook((select body from hook where k = 'captured'), (select sig from hook where k = 'captured'),
  'evt_2'), 'ignored', 'other events are recorded and ignored');
select is(public.razorpay_webhook((select body from hook where k = 'short'), (select sig from hook where k = 'short'),
  'evt_3'), 'amount_mismatch', 'a smaller amount does not approve');
select tests.login('owner@alpha.test');
select is((select status from public.payments where id = (select v from ids where k = 'a1')), 'waiting',
  'the payment still waits');
select tests.logout();
set local role anon;
select is(public.razorpay_webhook((select body from hook where k = 'good'), (select sig from hook where k = 'good'),
  'evt_4'), 'approved', 'order.paid with the exact amount approves');
select is(public.razorpay_webhook((select body from hook where k = 'good'), (select sig from hook where k = 'good'),
  'evt_4'), 'duplicate', 'the same event again does nothing');
select is(public.razorpay_webhook((select body from hook where k = 'good'), (select sig from hook where k = 'good'),
  'evt_5'), 'not_waiting', 'a second order.paid for a decided payment is not approved twice');
select is(public.razorpay_webhook((select body from hook where k = 'stranger'), (select sig from hook where k = 'stranger'),
  'evt_6'), 'unmatched', 'a receipt that is no payment of ours is not approved');
select tests.logout();
select results_eq($$ select status, razorpay_payment_id, receipt_no is not null from public.payments
  where id = (select v from ids where k = 'a1') $$, $$ values ('approved', 'pay_TestPay0000001', true) $$,
  'approved with the Razorpay payment id and a receipt');
select results_eq($$ select status, paid_until is not null from public.institutes where slug = 'alpha' $$,
  $$ values ('active', true) $$, 'the pilot became a paid plan');
select is((select count(*) from public.audit_events where action = 'billing.payment_approved' and actor_kind = 'system'
  and target_id = (select v from ids where k = 'a1')), 1::bigint, 'approved once, audited as system');
select is((select count(*) from public.audit_events where action = 'billing.razorpay_unmatched'), 3::bigint,
  'mismatch, second order and stranger are audited for a refund check');

-- ---------------------------------------------------------------- owner's Checkout id on bravo: recorded, never approves
select tests.login('owner@bravo.test');
insert into ids select 'b1', public.start_payment(tests.inst('bravo'), 'monthly');
select tests.login('owner@alpha.test');
select throws_ok($$ select public.submit_razorpay((select v from ids where k = 'b1'), 'pay_Forged00000001') $$, '42501',
  null, 'another institute''s owner cannot touch it');
select tests.login('owner@bravo.test');
select throws_ok($$ select public.submit_razorpay((select v from ids where k = 'b1'), 'pay_TestPay0000001') $$, 'P0001',
  'razorpay_invalid', 'a payment id used before is refused');
select lives_ok($$ select public.submit_razorpay((select v from ids where k = 'b1'), 'pay_BravoPay000001') $$,
  'the owner records the Checkout payment id');
select throws_ok($$ select public.start_payment(tests.inst('bravo'), 'monthly') $$, 'P0001', 'payment_waiting',
  'no second payment while it is being checked');
select throws_ok($$ select public.submit_utr((select v from ids where k = 'b1'), '123456789012') $$, 'P0001',
  'not_available', 'and no UTR on top of it');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.approve_payment((select v from ids where k = 'b1')) $$,
  'if the webhook never comes, the platform admin approves it by hand');

select * from finish();
rollback;
