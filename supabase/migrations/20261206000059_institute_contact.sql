-- Founder, 2026-11-02: the platform page records each institute's owner email and phone so the founder can reach them.
-- contact_email / contact_phone are filled when the institute is created (the form's owner email + a new phone box)
-- and editable on the institute page. Institutes created before this get the email of their newest owner invitation.
alter table public.institutes
  add column contact_email text check (contact_email = lower(contact_email) and length(contact_email) <= 254),
  add column contact_phone text check (contact_phone ~ '^[0-9+() -]{7,20}$');
grant update (contact_email, contact_phone) on public.institutes to authenticated; -- RLS: platform admin only

update public.institutes i set contact_email = (
  select v.email from public.invitations v where v.institute_id = i.id and v.role = 'owner'
  order by v.created_at desc limit 1);

drop function public.create_institute(text, text, text, text, int, date);
drop function private.create_institute(text, text, text, text, int, date);

create function private.create_institute(new_slug text, new_name text, new_host text, owner_email text,
                                         students int default null, ends date default null,
                                         phone text default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  s text := lower(trim(new_slug));
  h text := lower(trim(new_host));
  today date := (now() at time zone 'Asia/Kolkata')::date;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  inst uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  if s in ('admin', 'www', 'api', 'app', 'mail', 'staging', 'status', 'docs') then
    raise exception 'slug_reserved' using errcode = 'P0001';
  end if;
  if s !~ '^[a-z0-9-]{3,40}$' then raise exception 'slug_invalid' using errcode = 'P0001'; end if;
  if h !~ ('^' || s || '(\.[a-z0-9-]+)+$') then
    raise exception 'host_mismatch' using errcode = 'P0001';
  end if;
  if ends < today then raise exception 'pilot_end_past' using errcode = 'P0001'; end if;
  insert into public.institutes (slug, name, pilot_end, expected_students, contact_email, contact_phone)
  values (s, trim(new_name), coalesce(ends, today + 7), students, lower(trim(owner_email)), nullif(trim(phone), ''))
  returning id into inst;
  -- The default_quotas trigger made the row; a pilot gets its caps and $5 of AI with the hard stop on (migration 42).
  update public.institute_quotas set max_students = 5, max_staff = 20, monthly_ai_budget_micro_usd = 5000000,
    hard_stop = true where institute_id = inst;
  insert into public.institute_domains (hostname, institute_id) values (h, inst);
  insert into public.invitations (institute_id, email, role, token_hash, created_by)
  values (inst, lower(trim(owner_email)), 'owner', sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
create function public.create_institute(new_slug text, new_name text, new_host text, owner_email text,
                                        students int default null, ends date default null,
                                        phone text default null)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.create_institute(new_slug, new_name, new_host, owner_email, students, ends, phone) $$;

revoke execute on function private.create_institute(text, text, text, text, int, date, text),
  public.create_institute(text, text, text, text, int, date, text) from public;
grant execute on function private.create_institute(text, text, text, text, int, date, text),
  public.create_institute(text, text, text, text, int, date, text) to authenticated;
