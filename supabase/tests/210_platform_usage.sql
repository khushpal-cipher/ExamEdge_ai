-- R1.1 step 7 (ADR-041): tokens + cost this month per institute; platform admin (MFA) sees all, others not.
begin;
select tests.setup();
select * from no_plan();
insert into private.platform_admins (user_id, granted_by) values (tests.create_user('root@examedge.test'), 'test');

delete from public.usage_records;
insert into public.usage_records (institute_id, feature, provider, model, input_tokens, output_tokens,
                                  reserved_micro_usd, cost_micro_usd, outcome, created_at)
values (tests.inst('alpha'), 'tutor', 'fake', 'fake', 100, 20, 500, 300, 'ok', now()),
       (tests.inst('alpha'), 'tutor', 'fake', 'fake', 10, 0, 700, 0, 'pending', now()),
       (tests.inst('alpha'), 'tutor', 'fake', 'fake', 999, 999, 999, 999, 'ok',
        date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' - interval '1 second'),
       (tests.inst('bravo'), 'notes_gen', 'fake', 'fake', 5, 5, 40, 40, 'ok', now());

select tests.login('root@examedge.test', 'aal2');
select results_eq(
  $$ select institute_id, input_tokens, output_tokens, cost_micro_usd from public.platform_usage() order by 4 desc $$,
  $$ values (tests.inst('alpha'), 110::bigint, 20::bigint, 1000::bigint),
            (tests.inst('bravo'), 5::bigint, 5::bigint, 40::bigint) $$,
  'platform admin: this India month per institute, pending at its reservation, last month left out');

select tests.login('root@examedge.test');
select is((select count(*) from public.platform_usage()), 0::bigint, 'platform admin without MFA sees nothing');
select tests.login('owner@alpha.test');
select results_eq($$ select institute_id from public.platform_usage() $$, $$ values (tests.inst('alpha')) $$,
  'owner sees only their own institute');
select tests.login('teacher1@alpha.test');
select is((select count(*) from public.platform_usage()), 0::bigint, 'teacher sees nothing');
select tests.as_anon();
select throws_ok($$ select * from public.platform_usage() $$, '42501', null, 'anon cannot call it');

select * from finish();
rollback;
