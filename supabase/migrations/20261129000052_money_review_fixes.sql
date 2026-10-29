-- Batch D money review (2026-10-29), three fixes to the billing rules of migrations 43-51 (LAUNCH_PLAN billing spec):
-- 1. Extras (rule 6): a quarter without growth stopped every later extras bill, because extras_from moved only when
--    an extras payment was approved. The quote now takes the first finished quarter since extras_from whose peak is
--    above the covered count.
-- 2. Monthly bill (rule 6): an early renewal kept period_start at the first period, so the next bill counted old peaks
--    again. Approving a monthly or yearly payment now sets period_start to the start of the newly paid period.
-- 3. No AI top-up while the institute is read-only: AI is off then, so the top-up would be wasted.

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
    -- the first finished quarter of the paid year whose peak is above the covered count; a quarter without growth
    -- is skipped (the covered count only rises, so it can never owe anything later)
    select g.qs, g.qe, g.pk into q_start, q_end, peak
    from (select s.qs, (s.qs + interval '3 months')::date - 1 as qe,
                 (select coalesce(max(a.peak), 0) from public.account_peaks a
                  where a.institute_id = inst and a.day between s.qs and (s.qs + interval '3 months')::date - 1) as pk
          from (select (i.extras_from + make_interval(months => 3 * k))::date as qs
                from generate_series(0, 3) as k) s) g
    where g.qe < today and g.qe <= i.paid_until and g.pk > coalesce(i.covered_accounts, 0)
    order by g.qs limit 1;
    if q_start is null then return; end if;
    select * into l from public.price_lists where id = i.price_list_id;
    acc := peak; ps := q_start; pe := q_end;
    -- 3 months of the price difference, at the yearly discount
    base := round(3 * (private.price(peak, l.id) - private.price(i.covered_accounts, l.id))
                  * l.yearly_months_paid / 12.0)::bigint;
    pl := l.id;
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

create or replace function private.approve_payment(pay uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.payments;
  i public.institutes;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  ps date;
  pe date;
  receipt text;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  select * into p from public.payments where id = pay for update;
  if p.id is null or p.status <> 'waiting' or p.utr is null then
    raise exception 'not_available' using errcode = 'P0001';
  end if;
  select * into i from public.institutes where id = p.institute_id for update;
  receipt := 'EE-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
             || lpad(nextval('private.receipt_seq')::text, 5, '0');
  if p.kind in ('monthly', 'yearly') then
    -- paying early extends from the old end, so no paid day is lost (rule 5)
    ps := case when i.paid_until is not null and i.paid_until >= today then i.paid_until + 1 else today end;
    pe := (ps + case p.kind when 'monthly' then interval '1 month' else interval '12 months' end)::date - 1;
    update public.institutes set paid_until = pe, billing_plan = p.kind, period_start = ps,
      price_list_id = p.price_list_id, status = case when status = 'pilot' then 'active' else status end,
      covered_accounts = case when p.kind = 'yearly' then p.accounts end,
      extras_from = case when p.kind = 'yearly' then ps end
    where id = i.id;
  elsif p.kind = 'extras' then
    ps := p.period_start; pe := p.period_end;
    update public.institutes set covered_accounts = p.accounts, extras_from = p.period_end + 1 where id = i.id;
  end if;
  update public.payments set status = 'approved', receipt_no = receipt, decided_by = (select auth.uid()),
    decided_at = now(), period_start = ps, period_end = pe where id = pay;
  if exists (select 1 from public.institutes where id = i.id and status = 'active' and paid_until is not null) then
    perform private.apply_limits(i.id);
  end if;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (i.id, (select auth.uid()), 'platform_admin', 'billing.payment_approved', 'payments', pay,
          jsonb_build_object('kind', p.kind, 'total_paise', p.total_paise, 'receipt_no', receipt));
end $$;
