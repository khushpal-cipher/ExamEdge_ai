-- LAUNCH_PLAN steps 3-9 (Batch C, billing spec in docs/LAUNCH_PLAN.md): price per account in slabs, account counts and
-- peaks, limits that follow the count, UPI payments checked by hand, paid-until read-only with 3 days' grace, AI
-- top-ups. Money is whole paise; dates are India dates. A waiting payment gives no extra access (founder, 2026-10-26).

-- ---------------------------------------------------------------- price lists (rule 3)
-- A new list is a new row (add_price_list, platform admin, audited); an institute keeps the list of its current paid
-- period (institutes.price_list_id) and the next payment uses the newest one.
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  min_accounts int not null check (min_accounts >= 1),
  tier1_upto int not null check (tier1_upto >= min_accounts),
  tier1_paise bigint not null check (tier1_paise >= 0),
  tier2_upto int not null check (tier2_upto >= tier1_upto),
  tier2_paise bigint not null check (tier2_paise >= 0),
  tier3_paise bigint not null check (tier3_paise >= 0),
  yearly_months_paid int not null check (yearly_months_paid between 1 and 12),
  gst_percent int not null default 18 check (gst_percent between 0 and 28),
  topup_paise bigint not null check (topup_paise >= 0),
  topup_micro_usd bigint not null check (topup_micro_usd >= 0)
);
alter table public.price_lists enable row level security;
revoke all on public.price_lists from anon, authenticated;
grant select on public.price_lists to authenticated;
create policy price_lists_read on public.price_lists for select to authenticated using (true);
-- PRICING_PLAN §2a: first 300 at ₹200, 301-1,000 at ₹120, above 1,000 at ₹89; minimum 30; yearly = pay 10 get 12;
-- top-up ₹2,500 = $20 of AI.
insert into public.price_lists (min_accounts, tier1_upto, tier1_paise, tier2_upto, tier2_paise, tier3_paise,
                                yearly_months_paid, topup_paise, topup_micro_usd)
values (30, 300, 20000, 1000, 12000, 8900, 10, 250000, 20000000);

-- Price of `accounts` (never below the minimum) in paise, slabs like income tax. Invoker: price_lists is readable.
create function private.price(accounts int, pl uuid) returns bigint
language sql stable security invoker set search_path = '' as $$
  select (least(x.n, l.tier1_upto) * l.tier1_paise
          + greatest(least(x.n, l.tier2_upto) - l.tier1_upto, 0) * l.tier2_paise
          + greatest(x.n - l.tier2_upto, 0) * l.tier3_paise)::bigint
  from public.price_lists l, lateral (select greatest(accounts, l.min_accounts) as n) x
  where l.id = pl
$$;

create function private.newest_price_list() returns uuid
language sql stable security invoker set search_path = '' as $$
  select id from public.price_lists order by created_at desc, id limit 1 $$;

alter table private.settings add column gst_number text check (gst_number ~ '^[0-9A-Z]{15}$');
alter table public.institute_quotas add column staff_daily_requests int check (staff_daily_requests between 1 and 10000);
grant update (staff_daily_requests) on public.institute_quotas to authenticated; -- RLS: platform admin only

alter table public.institutes
  add column paid_until date,             -- last paid day (India date); null = never paid / old institute
  add column period_start date,           -- first day of the current paid period
  add column billing_plan text check (billing_plan in ('monthly', 'yearly')),
  add column covered_accounts int,        -- yearly: the count the year was paid for
  add column extras_from date,            -- yearly: first day of the quarter not yet checked for extras
  add column price_list_id uuid references public.price_lists (id);

-- ---------------------------------------------------------------- who is counted (rule 1) and the daily peak
create function private.account_count(inst uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.memberships m
  where m.institute_id = inst and m.status = 'active' and m.role in ('student', 'teacher', 'admin') $$;

create table public.account_peaks (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  day date not null,
  peak int not null check (peak >= 0),
  primary key (institute_id, day)
);
alter table public.account_peaks enable row level security;
revoke all on public.account_peaks from anon, authenticated;
grant select on public.account_peaks to authenticated;
create policy account_peaks_read on public.account_peaks for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}') or private.is_platform_admin());

-- Limits follow the count (rule 9, step 4): only for an institute that has paid. Updates only when a value changes.
create function private.apply_limits(inst uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare n int := greatest(private.account_count(inst), 30);
begin
  update public.institute_quotas set
    monthly_ai_budget_micro_usd = n * 600000::bigint + 31000000, hard_stop = true,
    max_storage_bytes = greatest(5, ceil(n / 50.0))::bigint * 1073741824,
    max_concurrent_jobs = case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end,
    student_daily_messages = 15, student_daily_generations = 5, staff_daily_requests = 30,
    max_students = null, max_staff = null, updated_at = now()
  where institute_id = inst
    and (monthly_ai_budget_micro_usd, hard_stop, max_storage_bytes, max_concurrent_jobs, student_daily_messages,
         student_daily_generations, staff_daily_requests, max_students, max_staff)
        is distinct from (n * 600000::bigint + 31000000, true, greatest(5, ceil(n / 50.0))::bigint * 1073741824,
         case when n > 3000 then 6 when n > 1000 then 4 when n > 600 then 3 else 2 end, 15, 5, 30, null, null);
end $$;

create function private.on_accounts_change() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.account_peaks as p (institute_id, day, peak)
  values (new.institute_id, (now() at time zone 'Asia/Kolkata')::date, private.account_count(new.institute_id))
  on conflict (institute_id, day) do update set peak = greatest(p.peak, excluded.peak);
  if exists (select 1 from public.institutes i
             where i.id = new.institute_id and i.status = 'active' and i.paid_until is not null) then
    perform private.apply_limits(new.institute_id);
  end if;
  return null;
end $$;
create trigger accounts_change after insert or update of status, role on public.memberships
  for each row execute function private.on_accounts_change();
-- Today's peak for the institutes that exist already.
insert into public.account_peaks (institute_id, day, peak)
select i.id, (now() at time zone 'Asia/Kolkata')::date, private.account_count(i.id) from public.institutes i;

-- ---------------------------------------------------------------- read-only now also covers an unpaid period (rule 8)
create or replace function private.read_only(inst uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.institutes i where i.id = inst and (
    (i.status = 'pilot' and i.pilot_end is not null
       and now() >= (i.pilot_end + 1)::timestamp at time zone 'Asia/Kolkata')
    or (i.status = 'active' and i.paid_until is not null            -- 3 days' grace after the last paid day
       and now() >= (i.paid_until + 4)::timestamp at time zone 'Asia/Kolkata')))
$$;

-- ---------------------------------------------------------------- payments (rule 7)
create sequence private.receipt_seq;
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  kind text not null check (kind in ('monthly', 'yearly', 'extras', 'topup')),
  accounts int,
  price_list_id uuid not null references public.price_lists (id),
  base_paise bigint not null check (base_paise >= 0),
  gst_paise bigint not null check (gst_paise >= 0),
  total_paise bigint not null check (total_paise = base_paise + gst_paise),
  topup_micro_usd bigint check (topup_micro_usd >= 0),
  utr text check (utr ~ '^[0-9]{12}$'),
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or length(trim(reject_reason)) > 0),
  receipt_no text unique,
  period_start date,
  period_end date,
  created_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index payments_utr_unique on public.payments (utr); -- one UTR, once, rejected ones included (fix 3)
create index on public.payments (institute_id, created_at desc);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy payments_read on public.payments for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}') or private.is_platform_admin());

create function private.topup_micro(inst uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(p.topup_micro_usd), 0)::bigint from public.payments p
  where p.institute_id = inst and p.kind = 'topup' and p.status = 'approved'
    and p.decided_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' $$;

-- What a payment of `kind` would cost now; no row = not available. Owner/admin of the institute or a platform admin.
create function private.bill_quote(inst uuid, pay_kind text)
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
  return query select pay_kind, acc, pl, base,
    case when (select s.gst_number from private.settings s) is null then 0::bigint
         else round(base * (select p.gst_percent from public.price_lists p where p.id = pl) / 100.0)::bigint end,
    base + case when (select s.gst_number from private.settings s) is null then 0::bigint
         else round(base * (select p.gst_percent from public.price_lists p where p.id = pl) / 100.0)::bigint end,
    ps, pe;
end $$;

-- The owner starts a payment; the server computes the amount. Repeating it for the same kind before a UTR is typed
-- gives the same row (a waiting amount never changes). One payment with a UTR waits at a time.
create function private.start_payment(inst uuid, pay_kind text) returns uuid
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

create function private.submit_utr(pay uuid, ref text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare p public.payments; r text := trim(ref);
begin
  select * into p from public.payments where id = pay for update;
  if p.id is null or not private.has_role(p.institute_id, '{owner}') then
    raise exception 'only the owner can pay' using errcode = '42501';
  end if;
  if p.status <> 'waiting' or p.utr is not null then raise exception 'not_available' using errcode = 'P0001'; end if;
  if r !~ '^[0-9]{12}$' then raise exception 'utr_invalid' using errcode = 'P0001'; end if;
  begin
    update public.payments set utr = r where id = pay;
  exception when unique_violation then
    raise exception 'utr_used' using errcode = 'P0001';
  end;
end $$;

create function private.approve_payment(pay uuid) returns void
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
    update public.institutes set paid_until = pe, billing_plan = p.kind,
      period_start = case when i.paid_until is not null and i.paid_until >= today then i.period_start else ps end,
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

create function private.reject_payment(pay uuid, reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare p public.payments;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  if length(trim(coalesce(reason, ''))) = 0 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into p from public.payments where id = pay for update;
  if p.id is null or p.status <> 'waiting' then raise exception 'not_available' using errcode = 'P0001'; end if;
  update public.payments set status = 'rejected', reject_reason = trim(reason), decided_by = (select auth.uid()),
    decided_at = now() where id = pay;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (p.institute_id, (select auth.uid()), 'platform_admin', 'billing.payment_rejected', 'payments', pay,
          jsonb_build_object('kind', p.kind, 'total_paise', p.total_paise));
end $$;

-- ---------------------------------------------------------------- platform: new price list, GST number
create function private.add_price_list(min_accounts int, tier1_upto int, tier1_paise bigint, tier2_upto int,
  tier2_paise bigint, tier3_paise bigint, yearly_months_paid int, topup_paise bigint, topup_micro_usd bigint)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare pl uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  insert into public.price_lists (min_accounts, tier1_upto, tier1_paise, tier2_upto, tier2_paise, tier3_paise,
                                  yearly_months_paid, topup_paise, topup_micro_usd)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id into pl;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'platform.price_list', 'price_lists', pl,
          jsonb_build_object('tier1_paise', tier1_paise, 'tier2_paise', tier2_paise, 'tier3_paise', tier3_paise));
  return pl;
end $$;

create function private.gst_number() returns text
language sql stable security definer set search_path = '' as $$
  select s.gst_number from private.settings s where private.is_platform_admin() $$;

create function private.set_gst_number(num text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  update private.settings set gst_number = nullif(upper(trim(num)), ''), updated_at = now() where id;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'platform.gst_number', jsonb_build_object('set', nullif(trim(num), '') is not null));
end $$;

-- ---------------------------------------------------------------- Bill page numbers
create function private.billing_status(inst uuid)
returns table (status text, pilot_end date, paid_until date, billing_plan text, covered_accounts int, accounts int,
               read_only boolean, ai_used_micro bigint, ai_budget_micro bigint)
language plpgsql stable security definer set search_path = '' as $$
declare i public.institutes; q public.institute_quotas; used bigint; since timestamptz;
begin
  if not (private.has_role(inst, '{owner,admin}') or private.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into i from public.institutes where id = inst;
  select * into q from public.institute_quotas where institute_id = inst;
  since := case when i.status = 'pilot' and i.pilot_end is not null then '-infinity'
                else date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' end;
  select coalesce(sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end), 0)::bigint
    into used from public.usage_records r where r.institute_id = inst and r.created_at >= since;
  return query select i.status, i.pilot_end, i.paid_until, i.billing_plan, i.covered_accounts,
    private.account_count(inst), private.read_only(inst), used, q.monthly_ai_budget_micro_usd + private.topup_micro(inst);
end $$;

-- ---------------------------------------------------------------- public wrappers (invoker), like the rest
create function public.bill_quote(inst uuid, pay_kind text)
returns table (kind text, accounts int, price_list_id uuid, base_paise bigint, gst_paise bigint, total_paise bigint,
               period_start date, period_end date)
language sql stable security invoker set search_path = '' as $$ select * from private.bill_quote(inst, pay_kind) $$;
create function public.billing_status(inst uuid)
returns table (status text, pilot_end date, paid_until date, billing_plan text, covered_accounts int, accounts int,
               read_only boolean, ai_used_micro bigint, ai_budget_micro bigint)
language sql stable security invoker set search_path = '' as $$ select * from private.billing_status(inst) $$;
create function public.start_payment(inst uuid, pay_kind text) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.start_payment(inst, pay_kind) $$;
create function public.submit_utr(pay uuid, ref text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.submit_utr(pay, ref) $$;
create function public.approve_payment(pay uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.approve_payment(pay) $$;
create function public.reject_payment(pay uuid, reason text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.reject_payment(pay, reason) $$;
create function public.add_price_list(min_accounts int, tier1_upto int, tier1_paise bigint, tier2_upto int,
  tier2_paise bigint, tier3_paise bigint, yearly_months_paid int, topup_paise bigint, topup_micro_usd bigint)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.add_price_list($1, $2, $3, $4, $5, $6, $7, $8, $9) $$;
create function public.gst_number() returns text
language sql stable security invoker set search_path = '' as $$ select private.gst_number() $$;
create function public.set_gst_number(num text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_gst_number(num) $$;

revoke execute on function private.price(int, uuid), private.newest_price_list(), private.account_count(uuid),
  private.apply_limits(uuid), private.on_accounts_change(), private.topup_micro(uuid), private.bill_quote(uuid, text),
  private.start_payment(uuid, text), private.submit_utr(uuid, text), private.approve_payment(uuid),
  private.reject_payment(uuid, text), private.gst_number(), private.set_gst_number(text),
  private.billing_status(uuid),
  private.add_price_list(int, int, bigint, int, bigint, bigint, int, bigint, bigint),
  public.bill_quote(uuid, text), public.billing_status(uuid), public.start_payment(uuid, text),
  public.submit_utr(uuid, text), public.approve_payment(uuid), public.reject_payment(uuid, text),
  public.add_price_list(int, int, bigint, int, bigint, bigint, int, bigint, bigint), public.gst_number(),
  public.set_gst_number(text) from public;
grant execute on function private.price(int, uuid), private.newest_price_list(), private.bill_quote(uuid, text),
  private.start_payment(uuid, text), private.submit_utr(uuid, text), private.approve_payment(uuid),
  private.reject_payment(uuid, text), private.gst_number(), private.set_gst_number(text),
  private.billing_status(uuid),
  private.add_price_list(int, int, bigint, int, bigint, bigint, int, bigint, bigint),
  public.bill_quote(uuid, text), public.billing_status(uuid), public.start_payment(uuid, text),
  public.submit_utr(uuid, text), public.approve_payment(uuid), public.reject_payment(uuid, text),
  public.add_price_list(int, int, bigint, int, bigint, bigint, int, bigint, bigint), public.gst_number(),
  public.set_gst_number(text) to authenticated;
-- ai_take runs as the caller (member or worker) and reads the month's top-ups.
grant execute on function private.topup_micro(uuid) to authenticated, worker;

-- ---------------------------------------------------------------- AI: top-ups raise the month's budget, staff daily cap
-- Same as migration 40 plus: the budget includes this month's approved top-ups, and a staff member's daily request cap.
create or replace function private.ai_take(inst uuid, uid uuid, feat text, prov text, mdl text, reserve bigint, job uuid)
returns table (record_id uuid, blocked text)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  caller text := case when uid is null then 'worker' else 'member' end;
  f private.ai_features;
  q public.institute_quotas;
  i public.institutes;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  since timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  spent bigint;
  lim int;
  n int;
  ckey text;
  why text;
  rid uuid;
begin
  select * into f from private.ai_features where feature = feat;
  if f is null or f.who <> caller then
    raise exception 'unknown_feature' using errcode = '22023';
  end if;
  if reserve < 0 or reserve > f.max_reserve_micro_usd then
    raise exception 'reserve_out_of_range' using errcode = '22023';
  end if;

  -- Serialises every reservation of this institute until the transaction ends.
  select * into q from public.institute_quotas where institute_id = inst for update;
  select * into i from public.institutes where id = inst;
  if i.status = 'pilot' and i.pilot_end is not null then since := '-infinity'; end if;

  -- shortcut: a stale student call keeps its daily counter (it resets at midnight anyway).
  update public.usage_records set outcome = 'error', settled_at = now()
  where institute_id = inst and outcome = 'pending' and created_at < now() - interval '1 hour';

  if not (select s.ai_enabled from private.settings s) or not q.ai_enabled or i.status = 'suspended'
     or private.read_only(inst) then
    why := 'ai_disabled';
  end if;

  if why is null and q.hard_stop then
    -- shortcut: sums this month's rows on every call; keep a running total when an institute reaches ~100K calls/month.
    select coalesce(sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end), 0)
      into spent from public.usage_records r where r.institute_id = inst and r.created_at >= since;
    if spent + reserve > q.monthly_ai_budget_micro_usd + private.topup_micro(inst) then why := 'budget'; end if;
  end if;

  -- Daily limits apply to students only; staff are limited by the institute budget.
  if why is null and f.counter_key is not null and exists (
       select 1 from public.memberships m
       where m.institute_id = inst and m.user_id = uid and m.role = 'student') then
    lim := case f.counter_key when 'messages' then q.student_daily_messages
                              when 'premium_messages' then q.student_daily_premium_messages
                              when 'searches' then q.student_daily_messages + q.student_daily_premium_messages
                              else q.student_daily_generations end;
    insert into public.usage_counters as c (institute_id, user_id, day, counter_key, value)
      select inst, uid, today, f.counter_key, 1 where lim > 0
      on conflict (institute_id, user_id, day, counter_key) do update set value = c.value + 1 where c.value < lim
      returning c.value into n;
    if n is null then why := 'quota'; else ckey := f.counter_key; end if;
  end if;

  -- Staff (founder answer 4): at most staff_daily_requests AI requests a day each (null = no cap). Counts the
  -- requests made under their own login; jobs the worker runs for them are covered by the institute budget.
  if why is null and uid is not null and q.staff_daily_requests is not null and exists (
       select 1 from public.memberships m
       where m.institute_id = inst and m.user_id = uid and m.role in ('owner', 'admin', 'teacher')) then
    select count(*) into n from public.usage_records r
    where r.institute_id = inst and r.user_id = uid and r.outcome <> 'quota_blocked'
      and r.created_at >= today::timestamp at time zone 'Asia/Kolkata';
    if n >= q.staff_daily_requests then why := 'quota'; end if;
  end if;

  insert into public.usage_records (institute_id, user_id, feature, provider, model, counter_key, job_id,
                                    reserved_micro_usd, outcome, settled_at)
  values (inst, uid, feat, prov, mdl, ckey, job, case when why is null then reserve else 0 end,
          case when why is null then 'pending' else 'quota_blocked' end,
          case when why is null then null else now() end)
  returning id into rid;
  return query select rid, why;
end $$;