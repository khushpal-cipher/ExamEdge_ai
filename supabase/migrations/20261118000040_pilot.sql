-- LAUNCH_PLAN step 1: the free pilot (ADR-058, billing spec rules 8 and 10).
-- A pilot runs until the end of `pilot_end` (India date). From the following midnight the institute is read-only:
-- members read everything but write nothing, AI is off, and an attempt already started can still be answered and
-- submitted (plan-review fix 5). Read-only is derived from the date by private.read_only(), so no job has to flip a
-- status at midnight (like test states, ADR-023); Batch C adds the paid rules to the same function.
-- A pilot has at most 10 students and 20 staff (founder can change both) and $10 of AI for its whole life.
-- Institutes created before this (pilot_end null) keep their old behaviour.

alter table public.institutes
  add column pilot_end date,
  add column expected_students int check (expected_students between 0 and 1000000);
grant update (pilot_end, expected_students) on public.institutes to authenticated; -- RLS: platform admin only

alter table public.institute_quotas
  add column max_students int check (max_students >= 0),
  add column max_staff int check (max_staff >= 0);
grant update (max_students, max_staff) on public.institute_quotas to authenticated; -- RLS: platform admin only

-- ---------------------------------------------------------------- read-only
create function private.read_only(inst uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.institutes i
                 where i.id = inst and i.status = 'pilot' and i.pilot_end is not null
                   and now() >= (i.pilot_end + 1)::timestamp at time zone 'Asia/Kolkata')
$$;

-- On every tenant table: a signed-in member of a read-only institute cannot write. The worker (no user) and platform
-- admins are not members, so retention purges and platform changes still run. Definer only so that auth.uid() also
-- works for the worker role, which has no access to schema auth; it writes nothing.
create function private.guard_read_only() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inst uuid := case when tg_op = 'DELETE' then old.institute_id else new.institute_id end;
begin
  if (select auth.uid()) is null then return case when tg_op = 'DELETE' then old else new end; end if;
  if not private.read_only(inst) or private.is_platform_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- An attempt started before the pilot ended can still be answered and submitted (no new attempt can start).
  if tg_table_name = 'test_attempts' and tg_op = 'UPDATE' then
    if old.status = 'in_progress' then return new; end if;
  elsif tg_table_name = 'attempt_answers' and tg_op <> 'DELETE' then
    if exists (select 1 from public.test_attempts a where a.id = new.attempt_id and a.status = 'in_progress') then
      return new;
    end if;
  end if;
  raise exception 'read_only' using errcode = 'P0001';
end $$;

-- Every public table with an institute_id except the metering and audit tables (written only by definer functions,
-- which check read_only themselves where it matters). pgTAP 270_pilot checks that new tables get it too.
do $$
declare t text;
begin
  for t in select c.table_name from information_schema.columns c
           join information_schema.tables x using (table_schema, table_name)
           where c.table_schema = 'public' and c.column_name = 'institute_id' and x.table_type = 'BASE TABLE'
             and c.table_name not in ('usage_records', 'usage_counters', 'audit_events')
  loop
    execute format('create trigger guard_read_only before insert or update or delete on public.%I
                    for each row execute function private.guard_read_only()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- seats
-- Students and staff (admin + teacher) are capped separately; the owner never counts. Checked when an invitation is
-- made (pending invitations count, so 50 links are not sent for 10 seats) and, as the hard rule, on the membership.
create function private.seats_full(inst uuid, member_role text, pending boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  with cap as (
    select case when member_role = 'student' then q.max_students else q.max_staff end as n
    from public.institute_quotas q where q.institute_id = inst),
  roles as (select case when member_role = 'student' then '{student}'::text[] else '{admin,teacher}' end as r)
  select (select n from cap) is not null and (
    (select count(*) from public.memberships m, roles
     where m.institute_id = inst and m.status = 'active' and m.role = any (roles.r))
    + case when pending then (select count(*) from public.invitations v, roles
         where v.institute_id = inst and v.role = any (roles.r) and v.accepted_at is null and v.revoked_at is null
           and v.expires_at > now()) else 0 end
  ) >= (select n from cap)
$$;

-- Checked only when the row takes a seat it did not hold (new, re-activated, or moved between student / staff / owner),
-- so a teacher made admin is not counted twice.
create function private.guard_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and new.role <> 'owner'
     and (tg_op = 'INSERT' or old.status <> 'active'
          or (case old.role when 'student' then 's' when 'owner' then 'o' else 't' end)
             <> (case new.role when 'student' then 's' else 't' end))
     and private.seats_full(new.institute_id, new.role, false) then
    raise exception 'seats_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_seats before insert or update of role, status on public.memberships
  for each row execute function private.guard_seats();

-- Same as Phase 2 plus the seat check (after revoking this email's old link, which no longer holds a seat).
create or replace function private.create_invitation(inst uuid, invite_email text, invite_role text, batch uuid default null)
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
  if invite_role <> 'owner' and private.seats_full(inst, invite_role, true) then
    raise exception 'seats_full' using errcode = 'P0001';
  end if;
  insert into public.invitations (institute_id, email, role, batch_id, token_hash, created_by)
  values (inst, addr, invite_role, batch, sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;

-- ---------------------------------------------------------------- new institutes start as a pilot
drop function public.create_institute(text, text, text, text);
drop function private.create_institute(text, text, text, text);

create function private.create_institute(new_slug text, new_name text, new_host text, owner_email text,
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
  -- The default_quotas trigger made the row; a pilot gets its caps and $10 of AI with the hard stop on.
  update public.institute_quotas set max_students = 10, max_staff = 20, monthly_ai_budget_micro_usd = 10000000,
    hard_stop = true where institute_id = inst;
  insert into public.institute_domains (hostname, institute_id) values (h, inst);
  insert into public.invitations (institute_id, email, role, token_hash, created_by)
  values (inst, lower(trim(owner_email)), 'owner', sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
create function public.create_institute(new_slug text, new_name text, new_host text, owner_email text,
                                        students int default null, ends date default null)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.create_institute(new_slug, new_name, new_host, owner_email, students, ends) $$;

revoke execute on function private.create_institute(text, text, text, text, int, date),
  public.create_institute(text, text, text, text, int, date), private.read_only(uuid),
  private.guard_read_only(), private.seats_full(uuid, text, boolean), private.guard_seats() from public;
grant execute on function private.create_institute(text, text, text, text, int, date),
  public.create_institute(text, text, text, text, int, date), private.read_only(uuid),
  private.guard_read_only() to authenticated;
grant execute on function private.read_only(uuid), private.guard_read_only() to worker;

-- ---------------------------------------------------------------- AI
-- Same as migration 39 plus: no AI while read-only, and a pilot's budget covers its whole life, not one month.
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
    if spent + reserve > q.monthly_ai_budget_micro_usd then why := 'budget'; end if;
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

  insert into public.usage_records (institute_id, user_id, feature, provider, model, counter_key, job_id,
                                    reserved_micro_usd, outcome, settled_at)
  values (inst, uid, feat, prov, mdl, ckey, job, case when why is null then reserve else 0 end,
          case when why is null then 'pending' else 'quota_blocked' end,
          case when why is null then null else now() end)
  returning id into rid;
  return query select rid, why;
end $$;
