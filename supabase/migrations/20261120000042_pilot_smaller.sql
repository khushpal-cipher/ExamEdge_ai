-- Founder, 2026-10-29: a free pilot is now 5 students and $5 of AI (was 10 and $10). Only new institutes are affected;
-- pilots that already exist keep their caps (the founder can edit them on the platform institute page).
create or replace function private.create_institute(new_slug text, new_name text, new_host text, owner_email text,
                                         students int default null, ends date default null)
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
  insert into public.institutes (slug, name, pilot_end, expected_students)
  values (s, trim(new_name), coalesce(ends, today + 7), students) returning id into inst;
  -- The default_quotas trigger made the row; a pilot gets its caps and $5 of AI with the hard stop on.
  update public.institute_quotas set max_students = 5, max_staff = 20, monthly_ai_budget_micro_usd = 5000000,
    hard_stop = true where institute_id = inst;
  insert into public.institute_domains (hostname, institute_id) values (h, inst);
  insert into public.invitations (institute_id, email, role, token_hash, created_by)
  values (inst, lower(trim(owner_email)), 'owner', sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
