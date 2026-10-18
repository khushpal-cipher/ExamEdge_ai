-- ADR-041 part 2 (first step): the owner's monthly AI bill in ₹ at the rate the platform admin sets.
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

delete from public.usage_records;
insert into public.usage_records (institute_id, feature, provider, model, input_tokens, output_tokens,
                                  reserved_micro_usd, cost_micro_usd, outcome, created_at)
values (tests.inst('alpha'), 'tutor', 'fake', 'fake', 100, 20, 500000, 300000, 'ok', now()),
       (tests.inst('alpha'), 'tutor', 'fake', 'fake', 10, 0, 700000, 0, 'pending', now()),
       (tests.inst('alpha'), 'tutor', 'fake', 'fake', 9, 9, 9000000, 9000000, 'ok',
        date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' - interval '1 second'),
       (tests.inst('bravo'), 'notes_gen', 'fake', 'fake', 5, 5, 40, 40, 'ok', now());

select tests.login('owner@alpha.test');
select results_eq($$ select cost_micro_usd, inr_per_usd, amount_inr from public.institute_bill(tests.inst('alpha')) $$,
  $$ values (1000000::bigint, null::numeric, null::numeric) $$, 'before a rate is set: cost only, no ₹ amount');
select throws_ok($$ select public.set_inr_per_usd(90) $$, '42501', null, 'an owner cannot set the rate');

select tests.login('root@examedge.test');
select throws_ok($$ select public.set_inr_per_usd(90) $$, '42501', null, 'a platform admin needs MFA');
select tests.login('root@examedge.test', 'aal2');
select lives_ok($$ select public.set_inr_per_usd(88.5) $$, 'a platform admin with MFA sets the rate');
select throws_ok($$ select public.set_inr_per_usd(0) $$, '23514', null, 'the rate must be above 0');
select is((select count(*)::int from public.audit_events where action = 'platform.inr_per_usd'), 1, 'audited');
select is(public.inr_per_usd(), 88.50::numeric, 'the platform page reads the rate back');

select tests.login('owner@alpha.test');
select results_eq($$ select cost_micro_usd, inr_per_usd, amount_inr from public.institute_bill(tests.inst('alpha')) $$,
  $$ values (1000000::bigint, 88.50::numeric, 88.50::numeric) $$,
  'owner: this India month (pending at its reservation, last month left out) × rate');
select results_eq($$ select cost_micro_usd from public.institute_bill(tests.inst('bravo')) $$, $$ values (0::bigint) $$,
  'another institute''s usage counts as nothing');
select tests.login('teacher1@alpha.test');
select results_eq($$ select cost_micro_usd from public.institute_bill(tests.inst('alpha')) $$, $$ values (0::bigint) $$,
  'a teacher sees no usage');
select tests.as_anon();
select throws_ok($$ select * from public.institute_bill(tests.inst('alpha')) $$, '42501', null, 'anon cannot call it');

select * from finish();
rollback;
