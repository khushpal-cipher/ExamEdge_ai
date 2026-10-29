-- No grace period (founder, 2026-10-29): a paid plan is read-only from midnight IST after paid_until, like a pilot.
-- The owner then sees the plans on the Bill page again and pays to continue.
create or replace function private.read_only(inst uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.institutes i where i.id = inst and (
    (i.status = 'pilot' and i.pilot_end is not null
       and now() >= (i.pilot_end + 1)::timestamp at time zone 'Asia/Kolkata')
    or (i.status = 'active' and i.paid_until is not null
       and now() >= (i.paid_until + 1)::timestamp at time zone 'Asia/Kolkata')))
$$;
