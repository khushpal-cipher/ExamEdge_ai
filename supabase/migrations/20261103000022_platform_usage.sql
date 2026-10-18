-- R1.1 step 7 (ADR-041): AI use per institute this month (India month) for the platform "All institutes" table.
-- Invoker: RLS on usage_records decides what the caller sees (platform admins with MFA: every institute; owner/admin:
-- their own; everyone else: nothing). Counts only, no student data (TH-15). Pending calls count at their
-- reservation, like usage_summary.
create function public.platform_usage()
returns table (institute_id uuid, input_tokens bigint, output_tokens bigint, cost_micro_usd bigint)
language sql stable security invoker set search_path = '' as $$
  select r.institute_id, sum(r.input_tokens), sum(r.output_tokens),
         sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end)::bigint
  from public.usage_records r
  where r.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
  group by r.institute_id $$;

revoke execute on function public.platform_usage() from public;
grant execute on function public.platform_usage() to authenticated;
