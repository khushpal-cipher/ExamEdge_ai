-- Founder, 2026-10-29: charm pricing. Every payable total is 1 rupee below the round figure (6,000 -> 5,999, 2,500 -> 2,499).
create function private.charm(raw bigint) returns bigint
language sql immutable security invoker set search_path = '' as $$ select case when raw >= 10000 then raw - 100 else raw end $$;
grant execute on function private.charm(bigint) to authenticated;

create or replace function private.bill_quote(inst uuid, pay_kind text)
returns table (kind text, accounts int, price_list_id uuid, base_paise bigint, gst_paise bigint, total_paise bigint,
               period_start date, period_end date)
language plpgsql stable security definer set search_path = '' as $$
declare
  i public.institutes;
  pl uuid := private.newest_price_list();
  l public.price_lists;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  n int := private.account_count(inst);
  peak int;
  base bigint;
  q_start date;
  q_end date;
  acc int;
  ps date;
  pe date;
  pct int;
  tot bigint;
  b bigint;
begin
  if not (private.has_role(inst, '{owner,admin}') or private.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into i from public.institutes where id = inst;
  if pay_kind = 'monthly' then
    -- the highest count of the period now ending, or today's count if that is more (rule 6)
    select coalesce(max(a.peak), 0) into peak from public.account_peaks a
    where a.institute_id = inst and i.period_start is not null and a.day between i.period_start and i.paid_until;
    acc := greatest(peak, n);
    base := private.price(acc, pl);
  elsif pay_kind = 'yearly' then
    select * into l from public.price_lists where id = pl;
    acc := n;
    base := private.price(acc, pl) * l.yearly_months_paid;
  elsif pay_kind = 'extras' then
    if i.billing_plan is distinct from 'yearly' or i.extras_from is null then return; end if;
    q_start := i.extras_from;
    q_end := (q_start + interval '3 months')::date - 1;
    if today <= q_end or q_end > i.paid_until then return; end if; -- a quarter is billed once it is over
    select coalesce(max(a.peak), 0) into peak from public.account_peaks a
    where a.institute_id = inst and a.day between q_start and q_end;
    if peak <= coalesce(i.covered_accounts, 0) then return; end if;
    select * into l from public.price_lists where id = i.price_list_id;
    acc := peak; ps := q_start; pe := q_end;
    -- 3 months of the price difference, at the yearly discount
    base := round(3 * (private.price(peak, l.id) - private.price(i.covered_accounts, l.id))
                  * l.yearly_months_paid / 12.0)::bigint;
    pl := l.id;
  elsif pay_kind = 'topup' then
    if i.status <> 'active' then return; end if;
    base := (select p.topup_paise from public.price_lists p where p.id = pl);
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  -- Charm pricing (founder, 2026-10-29): the payable total is ₹1 less than the round figure (₹6,000 -> ₹5,999); GST,
  -- when there is a GST number, is inside that total so that total = base + GST still holds.
  pct := case when (select s.gst_number from private.settings s) is null then 0
              else (select p.gst_percent from public.price_lists p where p.id = pl) end;
  tot := private.charm(base + round(base * pct / 100.0)::bigint);
  b := case when pct = 0 then tot else round(tot * 100.0 / (100 + pct))::bigint end;
  return query select pay_kind, acc, pl, b, tot - b, tot, ps, pe;
end $$;
