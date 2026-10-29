-- Renewal reminder email (LAUNCH_PLAN step 8). The daily worker job asks which paid institutes end within 5 days
-- and have not been reminded for this paid_until yet, mails their active owners, then marks them reminded.
alter table public.institutes add column renewal_reminded_for date;

create function private.renewals_due() returns table (institute_id uuid, name text, paid_until date, owners text[])
language sql stable security definer set search_path = '' as $$
  select i.id, i.name, i.paid_until,
         array(select u.email::text from public.memberships m join auth.users u on u.id = m.user_id
               where m.institute_id = i.id and m.role = 'owner' and m.status = 'active' and u.email is not null)
  from public.institutes i
  where i.status = 'active' and i.paid_until is not null
    and i.paid_until between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date + 5
    and i.renewal_reminded_for is distinct from i.paid_until
$$;

create function private.mark_reminded(inst uuid, until date) returns void
language sql security definer set search_path = '' as $$
  update public.institutes set renewal_reminded_for = until where id = inst and paid_until = until
$$;

revoke execute on function private.renewals_due(), private.mark_reminded(uuid, date) from public, anon, authenticated;
grant execute on function private.renewals_due(), private.mark_reminded(uuid, date) to worker;
