-- Phase 3: portals shell. Institute quotas (DATABASE_DESIGN §4.6; enforced by the Phase 5 gateway), platform admin
-- management of institutes (create, suspend, branding, quotas), audited. Platform admins still cannot read tenant
-- rows (TH-15): they see institutes, domains and quotas only, and only with an MFA (aal2) session.

-- ---------------------------------------------------------------- quotas
create table public.institute_quotas (
  institute_id uuid primary key references public.institutes on delete cascade,
  monthly_ai_budget_micro_usd bigint not null default 20000000 check (monthly_ai_budget_micro_usd >= 0),
  student_daily_messages int not null default 40 check (student_daily_messages between 0 and 10000),
  student_daily_premium_messages int not null default 5 check (student_daily_premium_messages between 0 and 10000),
  student_daily_generations int not null default 10 check (student_daily_generations between 0 and 10000),
  max_storage_bytes bigint not null default 5368709120 check (max_storage_bytes >= 0),
  max_upload_bytes bigint not null default 52428800 check (max_upload_bytes between 0 and 524288000),
  max_concurrent_jobs int not null default 2 check (max_concurrent_jobs between 1 and 50),
  hard_stop boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Every institute gets default quotas, whichever path created it (RPC, ops script, seed).
create function private.default_quotas() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.institute_quotas (institute_id) values (new.id);
  return new;
end $$;
create trigger default_quotas after insert on public.institutes
  for each row execute function private.default_quotas();

-- Branding is rendered into CSS, so only a strict hex colour is accepted.
alter table public.institutes add constraint branding_shape check (
  jsonb_typeof(branding) = 'object'
  and (not branding ? 'color' or branding ->> 'color' ~ '^#[0-9a-f]{6}$')
  and branding - 'color' = '{}'::jsonb);

-- ---------------------------------------------------------------- audit: institutes and quotas too
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end) - '{email,token_hash}'::text[];
  inst uuid := coalesce(r ->> 'institute_id', case when tg_table_name = 'institutes' then r ->> 'id' end)::uuid;
begin
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (inst, (select auth.uid()),
          case when (select auth.uid()) is null then 'system'
               when private.is_platform_admin() then 'platform_admin' else 'user' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, coalesce(r ->> 'id', r ->> 'institute_id')::uuid,
          jsonb_build_object('new', case when tg_op <> 'DELETE' then r end,
                             'old', case when tg_op = 'UPDATE' then to_jsonb(old) - '{email,token_hash}'::text[] end));
  return null;
end $$;
create trigger audit after insert or update or delete on public.institutes
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.institute_quotas
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- platform admin: create institute
-- Creates the institute, its host and a one-time owner invitation; returns the raw token (only its hash is stored).
-- The host is built by the server from its configured root domain and must be <slug>.<something>.
create function private.create_institute(new_slug text, new_name text, new_host text, owner_email text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  s text := lower(trim(new_slug));
  h text := lower(trim(new_host));
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
  insert into public.institutes (slug, name) values (s, trim(new_name)) returning id into inst;
  insert into public.institute_domains (hostname, institute_id) values (h, inst);
  insert into public.invitations (institute_id, email, role, token_hash, created_by)
  values (inst, lower(trim(owner_email)), 'owner', sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
create function public.create_institute(new_slug text, new_name text, new_host text, owner_email text)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.create_institute(new_slug, new_name, new_host, owner_email)
$$;

revoke execute on function private.create_institute(text, text, text, text), private.default_quotas() from public;
grant execute on function private.create_institute(text, text, text, text) to authenticated;
revoke execute on function public.create_institute(text, text, text, text) from public;
grant execute on function public.create_institute(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- RLS + privileges
alter table public.institute_quotas enable row level security;
revoke all on public.institute_quotas from anon, authenticated;

grant select, update (monthly_ai_budget_micro_usd, student_daily_messages, student_daily_premium_messages,
  student_daily_generations, max_storage_bytes, max_upload_bytes, max_concurrent_jobs, hard_stop, updated_at)
  on public.institute_quotas to authenticated;
create policy quotas_read on public.institute_quotas for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}') or private.is_platform_admin());
create policy quotas_platform_update on public.institute_quotas for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

grant update (name, status, branding) on public.institutes to authenticated;
create policy institutes_platform_update on public.institutes for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- ---------------------------------------------------------------- membership guard: no student <-> staff switch
-- batch_members.batch_role must keep matching the membership role (guard_batch_member checks inserts only).
create or replace function private.guard_membership_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null
     and (old.role in ('owner', 'admin') or new.role in ('owner', 'admin'))
     and not private.has_role(old.institute_id, '{owner}') then
    raise exception 'only an owner can change owner or admin memberships' using errcode = '42501';
  end if;
  if (old.role = 'student') <> (new.role = 'student') then
    raise exception 'a student membership cannot become staff or the reverse; invite again' using errcode = '23514';
  end if;
  if new.status = 'removed' and old.status <> 'removed' then new.removed_at := now(); end if;
  if new.status <> 'removed' then new.removed_at := null; end if;
  return new;
end $$;
