-- Founder, 2026-11-02: daily AI caps per student come down to 25 doubts (was 40) and 10 study tools (was 20) to keep a
-- coaching's shared monthly pool from running out early. Staff stay at 60 requests; the monthly pool is unchanged.
-- Rows the founder set by hand to other values are left alone.
alter table public.institute_quotas alter column student_daily_messages set default 25;
alter table public.institute_quotas alter column student_daily_generations set default 10;
update public.institute_quotas set student_daily_messages = 25 where student_daily_messages = 40;
update public.institute_quotas set student_daily_generations = 10 where student_daily_generations = 20;

create or replace function private.apply_limits(inst uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare n int := greatest(private.account_count(inst), 50);
begin
  update public.institute_quotas set
    monthly_ai_budget_micro_usd = n * 600000::bigint + 31000000, hard_stop = true,
    max_storage_bytes = greatest(5, ceil(n / 50.0))::bigint * 1073741824,
    max_concurrent_jobs = case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end,
    student_daily_messages = 25, student_daily_generations = 10, staff_daily_requests = 60,
    max_students = null, max_staff = null, updated_at = now()
  where institute_id = inst
    and (monthly_ai_budget_micro_usd, hard_stop, max_storage_bytes, max_concurrent_jobs, student_daily_messages,
         student_daily_generations, staff_daily_requests, max_students, max_staff)
        is distinct from (n * 600000::bigint + 31000000, true, greatest(5, ceil(n / 50.0))::bigint * 1073741824,
         case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end, 25, 10, 60, null, null);
end $$;
