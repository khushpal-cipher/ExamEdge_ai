-- Phase 5: AI metering, quotas and kill switches (AI_PIPELINE §2, DATABASE_DESIGN §4.6, ADR-025).
-- Every AI call first reserves its worst-case cost (ai_reserve / ai_reserve_job), then settles the real cost once.
-- Reservations of one institute are serialised by locking its institute_quotas row, so parallel calls can never
-- spend past the budget or a student's daily limit (AC5.3).

-- ---------------------------------------------------------------- tables
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  user_id uuid references auth.users on delete set null, -- null = worker job
  feature text not null,
  provider text not null check (provider in ('fake', 'anthropic', 'voyage')),
  model text not null check (length(model) between 1 and 80),
  counter_key text, -- daily counter this call used (refunded when the call fails)
  job_id uuid, -- e.g. the document version an ingestion call belongs to
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens int not null default 0 check (cache_write_tokens >= 0),
  units int not null default 0 check (units >= 0),
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  outcome text not null default 'pending' check (outcome in ('pending', 'ok', 'error', 'refused', 'quota_blocked')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index on public.usage_records (institute_id, created_at);

create table public.usage_counters (
  institute_id uuid not null references public.institutes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day date not null, -- India date (resets at midnight IST, like test times, ADR-023)
  counter_key text not null check (counter_key in ('messages', 'premium_messages', 'generations')),
  value int not null check (value >= 0),
  primary key (institute_id, user_id, day, counter_key)
);

alter table public.institute_quotas add column ai_enabled boolean not null default true;

-- Which features exist, who may call them, which student counter they use, and the most one call may reserve.
-- A caller cannot pick a cheaper counter or reserve more than this (the browser never reaches these RPCs directly,
-- but a student could call them with their own token).
create table private.ai_features (
  feature text primary key,
  who text not null check (who in ('member', 'worker')),
  counter_key text check (counter_key in ('messages', 'premium_messages', 'generations')),
  max_reserve_micro_usd bigint not null check (max_reserve_micro_usd > 0)
);
insert into private.ai_features values
  ('tutor', 'member', 'messages', 100000),
  ('tutor_premium', 'member', 'premium_messages', 500000),
  ('query_embed', 'member', null, 10000),
  ('generation', 'member', 'generations', 200000),
  ('ingest_ocr', 'worker', null, 1000000),
  ('ingest_embed', 'worker', null, 1000000);

-- Platform-wide kill switch (AC5.4): one row, changed only through set_ai_enabled (audited).
create table private.settings (
  id boolean primary key default true check (id),
  ai_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into private.settings default values;

-- ---------------------------------------------------------------- core (invoker: only callable from the definers)
create function private.ai_take(inst uuid, uid uuid, feat text, prov text, mdl text, reserve bigint, job uuid)
returns table (record_id uuid, blocked text)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  caller text := case when uid is null then 'worker' else 'member' end;
  f private.ai_features;
  q public.institute_quotas;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
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

  if not (select s.ai_enabled from private.settings s) or not q.ai_enabled
     or (select i.status from public.institutes i where i.id = inst) = 'suspended' then
    why := 'ai_disabled';
  end if;

  if why is null and q.hard_stop then
    -- shortcut: sums this month's rows on every call; keep a running total when an institute reaches ~100K calls/month.
    select coalesce(sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end), 0)
      into spent from public.usage_records r where r.institute_id = inst and r.created_at >= month_start;
    if spent + reserve > q.monthly_ai_budget_micro_usd then why := 'budget'; end if;
  end if;

  -- Daily limits apply to students only; staff are limited by the institute budget.
  if why is null and f.counter_key is not null and exists (
       select 1 from public.memberships m
       where m.institute_id = inst and m.user_id = uid and m.role = 'student') then
    lim := case f.counter_key when 'messages' then q.student_daily_messages
                              when 'premium_messages' then q.student_daily_premium_messages
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

-- Settles one pending reservation of this caller. The cost is capped at what was reserved (the gateway reserves a
-- worst case), and a failed call gives the student their daily counter back.
create function private.ai_finish(inst uuid, uid uuid, rid uuid, usage jsonb, cost bigint, result text)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare
  r public.usage_records;
begin
  if result not in ('ok', 'error', 'refused') or cost < 0 then
    raise exception 'invalid_settlement' using errcode = '22023';
  end if;
  update public.usage_records u set
    input_tokens = coalesce((usage ->> 'input_tokens')::int, 0),
    output_tokens = coalesce((usage ->> 'output_tokens')::int, 0),
    cache_read_tokens = coalesce((usage ->> 'cache_read_tokens')::int, 0),
    cache_write_tokens = coalesce((usage ->> 'cache_write_tokens')::int, 0),
    units = coalesce((usage ->> 'units')::int, 0),
    cost_micro_usd = least(cost, u.reserved_micro_usd),
    outcome = result,
    settled_at = now()
  where u.id = rid and u.institute_id = inst and u.user_id is not distinct from uid and u.outcome = 'pending'
  returning * into r;
  if r is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if result = 'error' and r.counter_key is not null then
    update public.usage_counters c set value = greatest(c.value - 1, 0)
    where c.institute_id = inst and c.user_id = uid and c.counter_key = r.counter_key
      and c.day = (r.created_at at time zone 'Asia/Kolkata')::date;
  end if;
end $$;

-- ---------------------------------------------------------------- definers (the only entry points)
-- Signed-in member of `inst` (web server in the user's context; institute derived from the host).
create function private.ai_reserve(inst uuid, feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.member_id(inst) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query select * from private.ai_take(inst, (select auth.uid()), feat, prov, mdl, reserve, null);
end $$;

create function private.ai_settle(inst uuid, rid uuid, usage jsonb, cost bigint, result text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.member_id(inst) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform private.ai_finish(inst, (select auth.uid()), rid, usage, cost, result);
end $$;

-- Worker: the institute is the tenant context of the job (transaction-local app.institute_id), never a parameter.
create function private.ai_reserve_job(feat text, prov text, mdl text, reserve bigint, job uuid)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.job_institute() is null then raise exception 'no_tenant_context' using errcode = '42501'; end if;
  return query select * from private.ai_take(private.job_institute(), null, feat, prov, mdl, reserve, job);
end $$;

create function private.ai_settle_job(rid uuid, usage jsonb, cost bigint, result text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.job_institute() is null then raise exception 'no_tenant_context' using errcode = '42501'; end if;
  perform private.ai_finish(private.job_institute(), null, rid, usage, cost, result);
end $$;

create function private.ai_globally_enabled() returns boolean
language sql stable security definer set search_path = '' as $$ select ai_enabled from private.settings $$;

create function private.set_ai_enabled(enabled boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  -- PostgREST sessions load safeupdate, which refuses an UPDATE without WHERE (the table has one row).
  update private.settings set ai_enabled = enabled, updated_at = now() where id;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'platform.ai_enabled', jsonb_build_object('enabled', enabled));
end $$;

-- ---------------------------------------------------------------- public wrappers (invoker)
create function public.ai_reserve(inst uuid, feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language sql volatile security invoker set search_path = '' as $$
  select * from private.ai_reserve(inst, feat, prov, mdl, reserve) $$;
create function public.ai_settle(inst uuid, rid uuid, usage jsonb, cost bigint, result text) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.ai_settle(inst, rid, usage, cost, result) $$;
create function public.ai_enabled() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.ai_globally_enabled() $$;
create function public.set_ai_enabled(enabled boolean) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_ai_enabled(enabled) $$;

-- This month's usage per feature (India month), for the institute usage page and platform admin. RLS on
-- usage_records decides what the caller sees.
create function public.usage_summary(inst uuid)
returns table (feature text, calls bigint, blocked bigint, input_tokens bigint, output_tokens bigint,
               cost_micro_usd bigint)
language sql stable security invoker set search_path = '' as $$
  select r.feature, count(*) filter (where r.outcome <> 'quota_blocked'), count(*) filter (where r.outcome = 'quota_blocked'),
         sum(r.input_tokens), sum(r.output_tokens),
         sum(case when r.outcome = 'pending' then r.reserved_micro_usd else r.cost_micro_usd end)::bigint
  from public.usage_records r
  where r.institute_id = inst
    and r.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
  group by r.feature order by r.feature $$;

-- ---------------------------------------------------------------- privileges
revoke execute on function private.ai_take(uuid, uuid, text, text, text, bigint, uuid),
  private.ai_finish(uuid, uuid, uuid, jsonb, bigint, text), private.ai_reserve(uuid, text, text, text, bigint),
  private.ai_settle(uuid, uuid, jsonb, bigint, text), private.ai_reserve_job(text, text, text, bigint, uuid),
  private.ai_settle_job(uuid, jsonb, bigint, text), private.ai_globally_enabled(), private.set_ai_enabled(boolean),
  public.ai_reserve(uuid, text, text, text, bigint), public.ai_settle(uuid, uuid, jsonb, bigint, text),
  public.ai_enabled(), public.set_ai_enabled(boolean), public.usage_summary(uuid)
  from public;
grant execute on function private.ai_reserve(uuid, text, text, text, bigint),
  private.ai_settle(uuid, uuid, jsonb, bigint, text), private.ai_globally_enabled(), private.set_ai_enabled(boolean),
  public.ai_reserve(uuid, text, text, text, bigint), public.ai_settle(uuid, uuid, jsonb, bigint, text),
  public.ai_enabled(), public.set_ai_enabled(boolean), public.usage_summary(uuid) to authenticated;
grant execute on function private.ai_reserve_job(text, text, text, bigint, uuid),
  private.ai_settle_job(uuid, jsonb, bigint, text) to worker;

-- Append-only for every app role: rows are written only by the functions above (owner), never by API roles.
alter table public.usage_records enable row level security;
alter table public.usage_counters enable row level security;
revoke all on public.usage_records, public.usage_counters from anon, authenticated;
grant select on public.usage_records, public.usage_counters to authenticated;
create policy usage_read on public.usage_records for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}') or private.is_platform_admin());
create policy counters_read on public.usage_counters for select to authenticated
  using ((user_id = (select auth.uid()) and private.member_id(institute_id) is not null)
         or private.has_role(institute_id, '{owner,admin}'));

revoke update on public.institute_quotas from authenticated;
grant update (monthly_ai_budget_micro_usd, student_daily_messages, student_daily_premium_messages,
  student_daily_generations, max_storage_bytes, max_upload_bytes, max_concurrent_jobs, hard_stop, ai_enabled,
  updated_at) on public.institute_quotas to authenticated;
