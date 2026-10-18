-- ADR-041 part 2, first step (founder, 2026-10-18): the owner/admin "AI usage" page becomes a bill in rupees. The
-- platform admin sets one rate (₹ per US$) for every institute; the commission comes later (founder decides).
alter table private.settings add column inr_per_usd numeric(8, 2) check (inr_per_usd > 0); -- null = not set yet

create function private.inr_per_usd() returns numeric
language sql stable security definer set search_path = '' as $$ select inr_per_usd from private.settings $$;

create function private.set_inr_per_usd(rate numeric) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  update private.settings set inr_per_usd = rate, updated_at = now() where id; -- where: safeupdate (ADR-025)
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'platform.inr_per_usd', jsonb_build_object('rate', rate));
end $$;

create function public.inr_per_usd() returns numeric
language sql stable security invoker set search_path = '' as $$ select private.inr_per_usd() $$;
create function public.set_inr_per_usd(rate numeric) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_inr_per_usd(rate) $$;

-- This India month's AI charge of one institute. Invoker: RLS on usage_records decides (owner/admin: their own,
-- platform admin with MFA: any; others see 0). Pending calls count at their reservation, like platform_usage.
-- amount_inr is null until the rate is set.
create function public.institute_bill(inst uuid)
returns table (cost_micro_usd bigint, inr_per_usd numeric, amount_inr numeric)
language sql stable security invoker set search_path = '' as $$
  select c.cost, private.inr_per_usd(), round(c.cost / 1000000.0 * private.inr_per_usd(), 2)
  from (select coalesce(sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end), 0)::bigint
          as cost
        from public.usage_records r
        where r.institute_id = inst
          and r.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') c $$;

revoke execute on function private.inr_per_usd(), private.set_inr_per_usd(numeric), public.inr_per_usd(), public.set_inr_per_usd(numeric),
  public.institute_bill(uuid) from public;
grant execute on function private.inr_per_usd(), private.set_inr_per_usd(numeric), public.inr_per_usd(), public.set_inr_per_usd(numeric),
  public.institute_bill(uuid) to authenticated;
