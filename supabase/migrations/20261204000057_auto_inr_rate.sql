-- The ₹ per US$ rate updates itself: the daily worker job saves the market rate (the platform page no longer has a
-- field for it). A rate outside 50-200 is refused (bad data from the rate source).
create function private.auto_inr_per_usd(rate numeric) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if rate is null or rate not between 50 and 200 then return false; end if;
  update private.settings set inr_per_usd = round(rate, 2), updated_at = now() where id;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, metadata)
  values (null, null, 'system', 'platform.inr_per_usd_auto', jsonb_build_object('rate', round(rate, 2)));
  return true;
end $$;

revoke execute on function private.auto_inr_per_usd(numeric) from public, anon, authenticated;
grant execute on function private.auto_inr_per_usd(numeric) to worker;
