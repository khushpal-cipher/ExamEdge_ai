-- Founder, 2026-10-30 (go-live eve): (1) daily AI caps 40 doubts / 20 study tools per student, 60 requests per staff member
-- (was 15 / 5 / 30 for paid, 40 / 10 for pilots); the monthly AI pool is unchanged, so the worst-case cost is unchanged.
-- (2) minimum 50 accounts (was 30) for the price and the AI pool. Nobody has paid yet, so the current price list changes in
-- place; once a coaching has paid, add a new price list instead.
update public.price_lists set min_accounts = 50;
alter table public.institute_quotas alter column student_daily_generations set default 20;
update public.institute_quotas set student_daily_generations = 20 where student_daily_generations = 10;
update public.institute_quotas set student_daily_messages = 40 where student_daily_messages = 15;
update public.institute_quotas set student_daily_generations = 20 where student_daily_generations = 5;
update public.institute_quotas set staff_daily_requests = 60 where staff_daily_requests = 30;

create or replace function private.apply_limits(inst uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare n int := greatest(private.account_count(inst), 50);
begin
  update public.institute_quotas set
    monthly_ai_budget_micro_usd = n * 600000::bigint + 31000000, hard_stop = true,
    max_storage_bytes = greatest(5, ceil(n / 50.0))::bigint * 1073741824,
    max_concurrent_jobs = case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end,
    student_daily_messages = 40, student_daily_generations = 20, staff_daily_requests = 60,
    max_students = null, max_staff = null, updated_at = now()
  where institute_id = inst
    and (monthly_ai_budget_micro_usd, hard_stop, max_storage_bytes, max_concurrent_jobs, student_daily_messages,
         student_daily_generations, staff_daily_requests, max_students, max_staff)
        is distinct from (n * 600000::bigint + 31000000, true, greatest(5, ceil(n / 50.0))::bigint * 1073741824,
         case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end, 40, 20, 60, null, null);
end $$;
