-- Yearly plan only from 50 accounts (founder, 2026-10-30): at 30 accounts the 2 free months cost more than the profit.
-- A price list now has `yearly_min_accounts` (default 50). Same function as migration 53 plus one early return; the quote is then empty, so the Bill page offers monthly only.
alter table public.price_lists add column if not exists yearly_min_accounts int not null default 50 check (yearly_min_accounts >= 1);

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
  e record;
  base bigint;
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
  if pay_kind in ('monthly', 'yearly') then
    -- M4: renew only when nothing is paid, the period has ended, or in its last 7 days; an extras bill comes first
    if i.paid_until is not null and i.paid_until >= today + 7 then return; end if;
    if exists (select 1 from private.extras_due(inst)) then return; end if;
  end if;
  if pay_kind = 'monthly' then
    -- the highest count of the period now ending, or today's count if that is more (rule 6)
    acc := greatest(case when i.period_start is null then 0
                         else private.peak_between(inst, i.period_start, i.paid_until) end, n);
    base := private.price(acc, pl);
  elsif pay_kind = 'yearly' then
    select * into l from public.price_lists where id = pl;
    if n < l.yearly_min_accounts then return; end if;
    acc := n;
    base := private.price(acc, pl) * l.yearly_months_paid;
  elsif pay_kind = 'extras' then
    select * into e from private.extras_due(inst);
    if e.month_start is null then return; end if;
    acc := e.accounts; ps := e.month_start; pe := e.month_end; base := e.base_paise; pl := e.price_list_id;
  elsif pay_kind = 'topup' then
    if i.status <> 'active' or private.read_only(inst) then return; end if;
    base := (select p.topup_paise from public.price_lists p where p.id = pl);
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  -- Charm pricing (migrations 47-48): the payable total ends in 99; GST, when there is a GST number, is inside it.
  pct := case when (select s.gst_number from private.settings s) is null then 0
              else (select p.gst_percent from public.price_lists p where p.id = pl) end;
  tot := private.charm(base + round(base * pct / 100.0)::bigint);
  b := case when pct = 0 then tot else round(tot * 100.0 / (100 + pct))::bigint end;
  return query select pay_kind, acc, pl, b, tot - b, tot, ps, pe;
end $$;
