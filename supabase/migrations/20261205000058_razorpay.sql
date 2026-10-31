-- Razorpay online payment next to manual UPI (ADR-062). The database checks the webhook signature itself, because the
-- web has no privileged database access and the webhook arrives with no signed-in user.
-- * payments.razorpay_payment_id: like a UTR, the owner's "I have paid" (from a checked Checkout signature); it never
--   approves on its own. The webhook sets it too.
-- * private.payment_events: every webhook event id once (a repeat does nothing).
-- * private.razorpay_webhook: HMAC-SHA256(raw body, webhook secret), then order.paid with receipt = our payment id,
--   amount_paid = total_paise and INR approves the payment exactly like the platform Approve (audited as 'system').

alter table public.payments add column razorpay_payment_id text unique
  check (razorpay_payment_id ~ '^pay_[A-Za-z0-9]{8,30}$');

alter table private.settings add column razorpay_webhook_secret text
  check (razorpay_webhook_secret is null or length(razorpay_webhook_secret) >= 8);

create table private.payment_events (
  provider text not null,
  event_id text not null check (length(event_id) between 1 and 100),
  event text,
  payment_id uuid,
  result text,
  created_at timestamptz not null default now(),
  primary key (provider, event_id)
);
revoke all on private.payment_events from public, anon, authenticated;

-- ---------------------------------------------------------------- approve: one body, two doors
-- Internal: the platform Approve and the webhook both end here. Not callable by any API user.
create function private.approve_core(pay uuid, actor text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.payments;
  i public.institutes;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  ps date;
  pe date;
  receipt text;
begin
  select * into p from public.payments where id = pay for update;
  if p.id is null or p.status <> 'waiting' then raise exception 'not_available' using errcode = 'P0001'; end if;
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
  values (i.id, (select auth.uid()), actor, 'billing.payment_approved', 'payments', pay,
          jsonb_build_object('kind', p.kind, 'total_paise', p.total_paise, 'receipt_no', receipt));
end $$;

create or replace function private.approve_payment(pay uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  -- the owner said "paid": a UTR, or a Razorpay payment whose webhook did not arrive
  if not exists (select 1 from public.payments where id = pay and status = 'waiting'
                 and (utr is not null or razorpay_payment_id is not null)) then
    raise exception 'not_available' using errcode = 'P0001';
  end if;
  perform private.approve_core(pay, 'platform_admin');
end $$;

-- ---------------------------------------------------------------- owner side: same as migration 53, plus Razorpay
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
  if exists (select 1 from public.payments where institute_id = inst and status = 'waiting'
             and (utr is not null or razorpay_payment_id is not null)) then
    raise exception 'payment_waiting' using errcode = 'P0001';
  end if;
  -- One unpaid payment at a time, and only for 24 hours (M7).
  delete from public.payments where institute_id = inst and status = 'waiting' and utr is null
    and razorpay_payment_id is null and (kind <> pay_kind or created_at < now() - interval '24 hours');
  select id into pid from public.payments
  where institute_id = inst and kind = pay_kind and status = 'waiting' and utr is null and razorpay_payment_id is null;
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
  if p.status <> 'waiting' or p.utr is not null or p.razorpay_payment_id is not null then
    raise exception 'not_available' using errcode = 'P0001';
  end if;
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

-- The owner's Checkout finished (the web checked its signature). Recorded like a UTR; never approves. No 24-hour
-- check: money that was paid is recorded whatever the time.
create function private.submit_razorpay(pay uuid, ref text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare p public.payments;
begin
  select * into p from public.payments where id = pay for update;
  if p.id is null or not private.has_role(p.institute_id, '{owner}') then
    raise exception 'only the owner can pay' using errcode = '42501';
  end if;
  if p.status <> 'waiting' or p.utr is not null or p.razorpay_payment_id is not null then
    raise exception 'not_available' using errcode = 'P0001';
  end if;
  if ref is null or ref !~ '^pay_[A-Za-z0-9]{8,30}$' then raise exception 'razorpay_invalid' using errcode = 'P0001'; end if;
  begin
    update public.payments set razorpay_payment_id = ref where id = pay;
  exception when unique_violation then
    raise exception 'razorpay_invalid' using errcode = 'P0001';
  end;
end $$;

-- ---------------------------------------------------------------- platform: the webhook secret (write-only)
create function private.set_razorpay_secret(secret text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  update private.settings set razorpay_webhook_secret = nullif(trim(secret), ''), updated_at = now() where id;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'platform.razorpay_secret',
          jsonb_build_object('set', nullif(trim(secret), '') is not null));
end $$;

create function private.razorpay_ready() returns boolean
language sql stable security definer set search_path = '' as $$
  select s.razorpay_webhook_secret is not null from private.settings s where private.is_platform_admin() $$;

-- ---------------------------------------------------------------- the webhook (anyone may call; the HMAC decides)
create function private.razorpay_webhook(body text, signature text, event_id text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  sec text := (select s.razorpay_webhook_secret from private.settings s);
  j jsonb;
  o jsonb;
  rzp text;
  p public.payments;
  res text;
begin
  if sec is null then raise exception 'not_configured' using errcode = 'P0001'; end if;
  if body is null or signature is null
     or encode(extensions.hmac(convert_to(body, 'UTF8'), convert_to(sec, 'UTF8'), 'sha256'), 'hex')
        <> lower(signature) then
    raise exception 'bad_signature' using errcode = '42501';
  end if;
  j := body::jsonb;
  insert into private.payment_events (provider, event_id, event) values ('razorpay', event_id, j ->> 'event')
  on conflict do nothing;
  if not found then return 'duplicate'; end if;
  if j ->> 'event' is distinct from 'order.paid' then
    res := 'ignored';
  else
    o := j #> '{payload,order,entity}';
    rzp := j #>> '{payload,payment,entity,id}';
    if coalesce(o ->> 'receipt', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select * into p from public.payments where id = (o ->> 'receipt')::uuid for update;
    end if;
    res := case
      when p.id is null then 'unmatched'
      when p.status <> 'waiting' then 'not_waiting'
      when o ->> 'currency' is distinct from 'INR' or coalesce(o ->> 'amount_paid', '') !~ '^[0-9]{1,15}$'
           or (o ->> 'amount_paid')::bigint <> p.total_paise then 'amount_mismatch'
      when coalesce(rzp, '') !~ '^pay_[A-Za-z0-9]{8,30}$' then 'unmatched'
      else 'approved' end;
    if res = 'approved' then
      -- Razorpay's signed id wins over anything an owner typed, on this or another waiting payment
      update public.payments set razorpay_payment_id = null
      where razorpay_payment_id = rzp and id <> p.id and status = 'waiting';
      update public.payments set razorpay_payment_id = rzp where id = p.id;
      perform private.approve_core(p.id, 'system');
    else
      -- money may have arrived for nothing we can approve: the founder checks it (refund by hand)
      insert into public.audit_events (institute_id, actor_kind, action, target_type, target_id, metadata)
      values (p.institute_id, 'system', 'billing.razorpay_unmatched', 'payments', p.id,
              jsonb_build_object('result', res, 'order_id', o ->> 'id', 'payment_id', rzp,
                                 'amount_paid', o ->> 'amount_paid'));
    end if;
  end if;
  update private.payment_events set result = res, payment_id = p.id
  where provider = 'razorpay' and payment_events.event_id = razorpay_webhook.event_id;
  return res;
end $$;

-- ---------------------------------------------------------------- public wrappers (invoker), like the rest
create function public.submit_razorpay(pay uuid, ref text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.submit_razorpay(pay, ref) $$;
create function public.set_razorpay_secret(secret text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_razorpay_secret(secret) $$;
create function public.razorpay_ready() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.razorpay_ready() $$;
create function public.razorpay_webhook(body text, signature text, event_id text) returns text
language sql volatile security invoker set search_path = '' as $$
  select private.razorpay_webhook(body, signature, event_id) $$;

revoke execute on function private.approve_core(uuid, text), private.submit_razorpay(uuid, text),
  private.set_razorpay_secret(text), private.razorpay_ready(), private.razorpay_webhook(text, text, text),
  public.submit_razorpay(uuid, text), public.set_razorpay_secret(text), public.razorpay_ready(),
  public.razorpay_webhook(text, text, text) from public, anon, authenticated;
grant execute on function private.submit_razorpay(uuid, text), private.set_razorpay_secret(text),
  private.razorpay_ready(), public.submit_razorpay(uuid, text), public.set_razorpay_secret(text),
  public.razorpay_ready() to authenticated;
grant execute on function private.razorpay_webhook(text, text, text), public.razorpay_webhook(text, text, text)
  to anon, authenticated;
