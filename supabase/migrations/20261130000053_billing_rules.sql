-- Founder's billing rules from the Batch D money review (2026-10-29, LAUNCH_PLAN "Money review" M4-M7):
-- M4 A monthly or yearly payment can be started only when nothing is paid yet, the paid period has ended, or in its
--    last 7 days (no paying months ahead at today's small count).
-- M5 An extras bill unpaid 7 days after its month ends makes the institute read-only until it is approved.
-- M6 Yearly extras are checked every month (was every 3 months): accounts above the covered count are charged at the
--    full monthly price for every month left in the paid year, the month they joined included (no yearly discount).
-- M7 An unpaid payment (no UTR yet) is valid for 24 hours; after that "Pay" makes a fresh one at today's amount.
-- Also: a month's peak now includes the count carried in from before it (account_peaks.last = count after the day's
-- latest change), so accounts added just before a month starts are seen in that month.

alter table public.account_peaks add column last int check (last >= 0);
update public.account_peaks set last = peak;

create or replace function private.on_accounts_change() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.account_peaks as p (institute_id, day, peak, last)
  values (new.institute_id, (now() at time zone 'Asia/Kolkata')::date, private.account_count(new.institute_id),
          private.account_count(new.institute_id))
  on conflict (institute_id, day) do update set peak = greatest(p.peak, excluded.peak), last = excluded.last;
  if exists (select 1 from public.institutes i
             where i.id = new.institute_id and i.status = 'active' and i.paid_until is not null) then
    perform private.apply_limits(new.institute_id);
  end if;
  return null;
end $$;

-- Highest account count between two days: the day peaks inside, and the count carried in from before `d1`.
create function private.peak_between(inst uuid, d1 date, d2 date) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(
    (select coalesce(max(a.peak), 0) from public.account_peaks a
     where a.institute_id = inst and a.day between d1 and d2),
    (select coalesce(a.last, a.peak, 0) from public.account_peaks a
     where a.institute_id = inst and a.day < d1 order by a.day desc limit 1),
    0) $$;

-- The extras bill owed now (M6): the first finished month since extras_from whose peak costs more than the covered
-- count, charged for every month left in the paid year. No row = nothing owed. No caller check: internal only.
create function private.extras_due(inst uuid)
returns table (month_start date, month_end date, accounts int, months int, base_paise bigint, price_list_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.ms, m.me, m.pk, m.left_months,
         (private.price(m.pk, i.price_list_id) - private.price(i.covered_accounts, i.price_list_id)) * m.left_months,
         i.price_list_id
  from public.institutes i,
  lateral (
    select s.ms, (s.ms + interval '1 month')::date - 1 as me,
           private.peak_between(i.id, s.ms, (s.ms + interval '1 month')::date - 1) as pk,
           (select count(*)::int from generate_series(0, 11) j
            where (s.ms + make_interval(months => j))::date <= i.paid_until) as left_months
    from (select (i.extras_from + make_interval(months => k))::date as ms from generate_series(0, 11) k) s
  ) m
  where i.id = inst and i.status = 'active' and i.billing_plan = 'yearly' and i.extras_from is not null
    and i.covered_accounts is not null and i.paid_until is not null
    and m.me < (now() at time zone 'Asia/Kolkata')::date and m.me <= i.paid_until
    and private.price(m.pk, i.price_list_id) > private.price(i.covered_accounts, i.price_list_id)
  order by m.ms limit 1 $$;

-- M5: read-only also when an extras bill is still unpaid 7 days after its month ended.
create or replace function private.read_only(inst uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.institutes i where i.id = inst and (
    (i.status = 'pilot' and i.pilot_end is not null
       and now() >= (i.pilot_end + 1)::timestamp at time zone 'Asia/Kolkata')
    or (i.status = 'active' and i.paid_until is not null
       and now() >= (i.paid_until + 1)::timestamp at time zone 'Asia/Kolkata')
    or (i.status = 'active' and i.billing_plan = 'yearly' and exists (
          select 1 from private.extras_due(i.id) e
          where now() >= (e.month_end + 8)::timestamp at time zone 'Asia/Kolkata'))))
$$;

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

-- M7: an unpaid payment older than 24 hours is dropped and quoted again.
create or replace function private.start_payment(inst uuid, pay_kind text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare q record; pid uuid; l public.price_lists;
begin
  if not private.has_role(inst, '{owner}') then
    raise exception 'only the owner can pay' using errcode = '42501';
  end if;
  if exists (select 1 from public.institutes where id = inst and status in ('suspended', 'offboarding')) then
    raise exception 'not_available' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where institute_id = inst and status = 'waiting' and utr is not null) then
    raise exception 'payment_waiting' using errcode = 'P0001';
  end if;
  -- One unpaid payment at a time, and only for 24 hours (M7).
  delete from public.payments where institute_id = inst and status = 'waiting' and utr is null
    and (kind <> pay_kind or created_at < now() - interval '24 hours');
  select id into pid from public.payments
  where institute_id = inst and kind = pay_kind and status = 'waiting' and utr is null;
  if pid is not null then return pid; end if;
  select * into q from private.bill_quote(inst, pay_kind);
  if q.kind is null then raise exception 'not_available' using errcode = 'P0001'; end if;
  select * into l from public.price_lists where id = q.price_list_id;
  insert into public.payments (institute_id, kind, accounts, price_list_id, base_paise, gst_paise, total_paise,
                               topup_micro_usd, period_start, period_end, created_by)
  values (inst, q.kind, q.accounts, q.price_list_id, q.base_paise, q.gst_paise, q.total_paise,
          case when q.kind = 'topup' then l.topup_micro_usd end, q.period_start, q.period_end, (select auth.uid()))
  returning id into pid;
  return pid;
end $$;

create or replace function private.submit_utr(pay uuid, ref text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare p public.payments; r text := trim(ref);
begin
  select * into p from public.payments where id = pay for update;
  if p.id is null or not private.has_role(p.institute_id, '{owner}') then
    raise exception 'only the owner can pay' using errcode = '42501';
  end if;
  if p.status <> 'waiting' or p.utr is not null then raise exception 'not_available' using errcode = 'P0001'; end if;
  if p.created_at < now() - interval '24 hours' then
    raise exception 'payment_expired' using errcode = 'P0001';
  end if;
  if r !~ '^[0-9]{12}$' then raise exception 'utr_invalid' using errcode = 'P0001'; end if;
  begin
    update public.payments set utr = r where id = pay;
  exception when unique_violation then
    raise exception 'utr_used' using errcode = 'P0001';
  end;
end $$;

-- Any member may ask whether their institute is read-only (the portal banner); it reveals nothing else.
create function public.institute_read_only(inst uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case when private.has_role(inst, '{owner,admin,teacher,student}') then private.read_only(inst) end $$;

revoke execute on function private.peak_between(uuid, date, date), private.extras_due(uuid),
  public.institute_read_only(uuid) from public;
grant execute on function public.institute_read_only(uuid) to authenticated;
