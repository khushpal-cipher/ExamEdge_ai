-- Phase 2: identity, tenancy and isolation (DATABASE_DESIGN §3, §4.1, §4.2, §4.6; ADR-004, ADR-019).
-- Rules: RLS on every table; children use composite FKs (institute_id, parent_id); SECURITY DEFINER only in
-- schema `private` with search_path = ''; explicit grants (auto_expose_new_tables = false); no institute_id updates.
-- Emails/slugs/hostnames are lowercase-checked text, not citext: citext operators live in `extensions` and would
-- silently fall back to case-sensitive text comparison inside search_path = '' functions.

-- ---------------------------------------------------------------- privileges baseline
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------- global / platform
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,40}$'),
  name text not null
);
insert into public.exams (code, name) values ('JEE_MAIN', 'JEE Main'), ('NEET_UG', 'NEET UG');

create table public.institutes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (length(name) between 1 and 120),
  status text not null default 'pilot' check (status in ('pilot', 'active', 'suspended', 'offboarding')),
  cell text not null default 'main',
  branding jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.institute_domains (
  id uuid primary key default gen_random_uuid(),
  hostname text not null unique check (hostname = lower(hostname) and hostname ~ '^[a-z0-9.-]{3,253}$'),
  institute_id uuid not null references public.institutes on delete cascade,
  kind text not null default 'subdomain' check (kind in ('subdomain', 'custom')),
  verified_at timestamptz
);
create index on public.institute_domains (institute_id);

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text check (length(full_name) <= 120),
  avatar_url text check (length(avatar_url) <= 500),
  created_at timestamptz not null default now()
);

create table private.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  granted_by text not null,
  granted_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;

-- ---------------------------------------------------------------- tenant core
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'admin', 'teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (institute_id, user_id),
  unique (institute_id, id)
);
create index memberships_user_active on public.memberships (user_id, institute_id) where status = 'active';

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  name text not null check (length(name) between 1 and 120),
  academic_year text not null default '' check (length(academic_year) <= 20),
  exam_id uuid references public.exams,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institute_id, name, academic_year),
  unique (institute_id, id)
);

create table public.batch_members (
  batch_id uuid not null,
  membership_id uuid not null,
  institute_id uuid not null,
  batch_role text not null check (batch_role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  primary key (batch_id, membership_id),
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade,
  foreign key (institute_id, membership_id) references public.memberships (institute_id, id) on delete cascade
);
create index on public.batch_members (membership_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$' and length(email) <= 254),
  role text not null check (role in ('owner', 'admin', 'teacher', 'student')),
  batch_id uuid,
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade,
  check (batch_id is null or role in ('teacher', 'student'))
);
create unique index invitations_one_pending on public.invitations (institute_id, email)
  where accepted_at is null and revoked_at is null;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (institute_id, name),
  unique (institute_id, id)
);

create table public.batch_subjects (
  batch_id uuid not null,
  subject_id uuid not null,
  institute_id uuid not null,
  primary key (batch_id, subject_id),
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade,
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade
);
create index on public.batch_subjects (subject_id);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  subject_id uuid not null,
  name text not null check (length(name) between 1 and 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade
);
create index on public.chapters (institute_id, subject_id, position);

-- ---------------------------------------------------------------- audit, consent
-- No FK on institute_id: audit rows outlive a deleted institute (DATABASE_DESIGN §7).
create table public.audit_events (
  id bigint generated always as identity primary key,
  institute_id uuid,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'platform_admin', 'worker', 'system')),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index on public.audit_events (institute_id, created_at);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'guardian_consent', 'ai_processing')),
  policy_version text not null,
  method text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  evidence_ref text
);
create index on public.consent_records (user_id);

-- ---------------------------------------------------------------- RLS helpers (DATABASE_DESIGN §3)
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  -- MFA required (AC2.7): the session must be aal2.
  select exists (select 1 from private.platform_admins where user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

create function private.has_role(inst uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.institutes i on i.id = m.institute_id
    where m.institute_id = inst and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role = any (roles) and i.status <> 'suspended')
$$;

create function private.member_id(inst uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.memberships m join public.institutes i on i.id = m.institute_id
  where m.institute_id = inst and m.user_id = (select auth.uid()) and m.status = 'active' and i.status <> 'suspended'
$$;

create function private.in_batch(batch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.batch_members bm
    join public.memberships m on m.id = bm.membership_id
    join public.institutes i on i.id = m.institute_id
    where bm.batch_id = batch and m.user_id = (select auth.uid()) and m.status = 'active' and i.status <> 'suspended')
$$;

create function private.teaches_batch(batch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.batches b where b.id = batch and private.has_role(b.institute_id, '{owner,admin}'))
  or exists (
    select 1 from public.batch_members bm
    join public.memberships m on m.id = bm.membership_id
    join public.institutes i on i.id = m.institute_id
    where bm.batch_id = batch and bm.batch_role = 'teacher' and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin', 'teacher') and i.status <> 'suspended')
$$;

-- Teachers see memberships of students enrolled in a batch they teach.
create function private.teaches_member(membership uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.batch_members bm
    where bm.membership_id = membership and bm.batch_role = 'student' and private.teaches_batch(bm.batch_id))
$$;

-- Students see subjects/chapters of the batches they are enrolled in.
create function private.has_subject(subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.batch_subjects bs
    join public.batch_members bm on bm.batch_id = bs.batch_id
    join public.memberships m on m.id = bm.membership_id
    join public.institutes i on i.id = m.institute_id
    where bs.subject_id = subject and m.user_id = (select auth.uid()) and m.status = 'active'
      and i.status <> 'suspended')
$$;

create function private.shares_institute_as_staff(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships t
    join public.memberships me on me.institute_id = t.institute_id
    join public.institutes i on i.id = t.institute_id
    where t.user_id = target and t.status = 'active'
      and me.user_id = (select auth.uid()) and me.status = 'active'
      and me.role in ('owner', 'admin', 'teacher') and i.status <> 'suspended')
$$;

-- ---------------------------------------------------------------- triggers
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Display name only; raw_user_meta_data is user-editable and never used for authorization.
  insert into public.profiles (user_id, full_name, avatar_url)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
          left(new.raw_user_meta_data ->> 'avatar_url', 500));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Audit every membership, batch membership and invitation change (AC2.6). Ids/roles only, never email or token.
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end) - '{email,token_hash}'::text[];
begin
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values ((r ->> 'institute_id')::uuid, (select auth.uid()),
          case when (select auth.uid()) is null then 'system' else 'user' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, (r ->> 'id')::uuid,
          jsonb_build_object('new', case when tg_op <> 'DELETE' then r end,
                             'old', case when tg_op = 'UPDATE' then to_jsonb(old) - '{email,token_hash}'::text[] end));
  return null;
end $$;
create trigger audit after insert or update or delete on public.memberships
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.batch_members
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.invitations
  for each row execute function private.audit_row();

-- Only owners may create, change or remove owner/admin memberships. auth.uid() is null for ops scripts.
create function private.guard_membership_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null
     and (old.role in ('owner', 'admin') or new.role in ('owner', 'admin'))
     and not private.has_role(old.institute_id, '{owner}') then
    raise exception 'only an owner can change owner or admin memberships' using errcode = '42501';
  end if;
  if new.status = 'removed' and old.status <> 'removed' then new.removed_at := now(); end if;
  if new.status <> 'removed' then new.removed_at := null; end if;
  return new;
end $$;
create trigger guard before update on public.memberships
  for each row execute function private.guard_membership_update();

-- A batch student must be a student member; a batch teacher must be staff.
create function private.guard_batch_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  select role into r from public.memberships where id = new.membership_id;
  if (new.batch_role = 'student') <> (r = 'student') then
    raise exception 'batch_role % does not match membership role %', new.batch_role, r using errcode = '23514';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.batch_members
  for each row execute function private.guard_batch_member();

-- ---------------------------------------------------------------- RPCs (definer in private, invoker wrapper in public)
create function private.resolve_institute(host text)
returns table (id uuid, slug text, name text, status text, branding jsonb)
language sql stable security definer set search_path = '' as $$
  select i.id, i.slug, i.name, i.status, i.branding
  from public.institute_domains d join public.institutes i on i.id = d.institute_id
  where d.hostname = lower(host)
$$;
create function public.resolve_institute(host text)
returns table (id uuid, slug text, name text, status text, branding jsonb)
language sql stable security invoker set search_path = '' as $$ select * from private.resolve_institute(host) $$;

-- Returns the raw token once; only its SHA-256 is stored. Institute comes from the server (host), and the
-- caller's role in it is re-checked here, so a forged institute id fails (AC2.5).
create function private.create_invitation(inst uuid, invite_email text, invite_role text, batch uuid default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  addr text := lower(trim(invite_email));
begin
  if not (
    (invite_role in ('owner', 'admin') and private.has_role(inst, '{owner}'))
    or (invite_role in ('teacher', 'student') and private.has_role(inst, '{owner,admin}'))
    or (invite_role = 'student' and batch is not null and private.has_role(inst, '{teacher}')
        and private.teaches_batch(batch))
  ) then
    raise exception 'not allowed to invite this role' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where institute_id = inst and email = addr and accepted_at is null and revoked_at is null;
  insert into public.invitations (institute_id, email, role, batch_id, token_hash, created_by)
  values (inst, addr, invite_role, batch, sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
create function public.create_invitation(inst uuid, invite_email text, invite_role text, batch uuid default null)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.create_invitation(inst, invite_email, invite_role, batch)
$$;

-- Google login alone never creates a membership (AC2.3); only this does, and only for the invited verified email.
-- shortcut: no per-user attempt limit — tokens are 256-bit random; add one if abuse shows up in audit logs.
create function private.accept_invitation(token text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  user_email text;
  inv public.invitations;
  mid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = sha256(convert_to(token, 'UTF8')) for update;
  if not found then raise exception 'invitation_invalid' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'invitation_not_usable' using errcode = 'P0001';
  end if;
  select lower(u.email) into user_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if user_email is distinct from inv.email then raise exception 'email_mismatch' using errcode = 'P0001'; end if;
  if exists (select 1 from public.memberships where institute_id = inv.institute_id and user_id = uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.memberships (institute_id, user_id, role) values (inv.institute_id, uid, inv.role)
  returning id into mid;
  if inv.batch_id is not null then
    insert into public.batch_members (batch_id, membership_id, institute_id, batch_role)
    values (inv.batch_id, mid, inv.institute_id, case when inv.role = 'student' then 'student' else 'teacher' end);
  end if;
  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.institute_id;
end $$;
create function public.accept_invitation(token text) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.accept_invitation(token) $$;

-- ---------------------------------------------------------------- function privileges
revoke execute on all functions in schema private from public;
grant execute on function private.is_platform_admin(), private.has_role(uuid, text[]), private.member_id(uuid),
  private.in_batch(uuid), private.teaches_batch(uuid), private.teaches_member(uuid), private.has_subject(uuid),
  private.shares_institute_as_staff(uuid), private.create_invitation(uuid, text, text, uuid),
  private.accept_invitation(text) to authenticated;
grant execute on function private.resolve_institute(text) to anon, authenticated;
revoke execute on function public.resolve_institute(text), public.create_invitation(uuid, text, text, uuid),
  public.accept_invitation(text) from public;
grant execute on function public.resolve_institute(text) to anon, authenticated;
grant execute on function public.create_invitation(uuid, text, text, uuid), public.accept_invitation(text)
  to authenticated;

-- ---------------------------------------------------------------- RLS + table privileges
alter table public.exams enable row level security;
alter table public.institutes enable row level security;
alter table public.institute_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.batches enable row level security;
alter table public.batch_members enable row level security;
alter table public.invitations enable row level security;
alter table public.subjects enable row level security;
alter table public.batch_subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.audit_events enable row level security;
alter table public.consent_records enable row level security;

-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN ignore RLS; the local default ACL grants them (ADR-019).
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.exams to authenticated;
create policy exams_read on public.exams for select to authenticated using (true);

grant select on public.institutes to authenticated;
create policy institutes_read on public.institutes for select to authenticated
  using (private.has_role(id, '{owner,admin,teacher,student}') or private.is_platform_admin());

grant select on public.institute_domains to authenticated;
create policy domains_platform_read on public.institute_domains for select to authenticated
  using (private.is_platform_admin());

grant select, update (full_name, avatar_url) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_institute_as_staff(user_id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, update (role, status) on public.memberships to authenticated;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(institute_id, '{owner,admin}')
         or (private.has_role(institute_id, '{teacher}') and private.teaches_member(id)));
create policy memberships_manage on public.memberships for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}')) with check (private.has_role(institute_id, '{owner,admin}'));

grant select, insert (institute_id, name, academic_year, exam_id),
  update (name, academic_year, exam_id, archived_at), delete on public.batches to authenticated;
create policy batches_read on public.batches for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.in_batch(id));
create policy batches_insert on public.batches for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin}'));
create policy batches_update on public.batches for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}')) with check (private.has_role(institute_id, '{owner,admin}'));
create policy batches_delete on public.batches for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin}'));

grant select, insert (batch_id, membership_id, institute_id, batch_role), delete on public.batch_members
  to authenticated;
create policy batch_members_read on public.batch_members for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or membership_id = private.member_id(institute_id));
create policy batch_members_insert on public.batch_members for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin}')
              or (batch_role = 'student' and private.has_role(institute_id, '{teacher}')
                  and private.teaches_batch(batch_id)));
create policy batch_members_delete on public.batch_members for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin}')
         or (batch_role = 'student' and private.has_role(institute_id, '{teacher}') and private.teaches_batch(batch_id)));

grant select (id, institute_id, email, role, batch_id, expires_at, accepted_at, accepted_by, revoked_at, created_by,
  created_at), update (revoked_at) on public.invitations to authenticated;
create policy invitations_read on public.invitations for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}')
         or (created_by = (select auth.uid()) and private.has_role(institute_id, '{teacher}')));
create policy invitations_revoke on public.invitations for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}')
         or (created_by = (select auth.uid()) and private.has_role(institute_id, '{teacher}')))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));

grant select, insert (institute_id, name), update (name), delete on public.subjects to authenticated;
create policy subjects_read on public.subjects for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.has_subject(id));
create policy subjects_write on public.subjects for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin}'));
create policy subjects_update on public.subjects for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}')) with check (private.has_role(institute_id, '{owner,admin}'));
create policy subjects_delete on public.subjects for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin}'));

grant select, insert (batch_id, subject_id, institute_id), delete on public.batch_subjects to authenticated;
create policy batch_subjects_read on public.batch_subjects for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.in_batch(batch_id));
create policy batch_subjects_insert on public.batch_subjects for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin}'));
create policy batch_subjects_delete on public.batch_subjects for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin}'));

grant select, insert (institute_id, subject_id, name, position), update (name, position), delete
  on public.chapters to authenticated;
create policy chapters_read on public.chapters for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.has_subject(subject_id));
create policy chapters_insert on public.chapters for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy chapters_update on public.chapters for update to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy chapters_delete on public.chapters for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));

grant select on public.audit_events to authenticated;
create policy audit_read on public.audit_events for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}') or private.is_platform_admin());

grant select, insert (kind, policy_version, method, evidence_ref), update (withdrawn_at) on public.consent_records
  to authenticated;
create policy consent_own_read on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy consent_own_insert on public.consent_records for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy consent_own_update on public.consent_records for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
