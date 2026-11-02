-- Founder test (2026-11-02): Pay pressed on Nov 1 was reused on Nov 2, so the payment row carried the old date.
-- An unpaid draft is now dropped after 15 minutes when Pay is pressed again (a UTR is still accepted for 24 hours on a
-- draft that has not been replaced). Same as migration 58, only the interval changes.
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
  delete from public.payments where institute_id = inst and status = 'waiting' and utr is null
    and razorpay_payment_id is null and (kind <> pay_kind or created_at < now() - interval '15 minutes');
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
