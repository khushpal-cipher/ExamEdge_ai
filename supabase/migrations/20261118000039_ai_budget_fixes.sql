-- Launch fixes CR 1 and CR 2 (LAUNCH_PLAN "Code review findings", Batch B).
-- 1: the tutor's notes search (`query_embed`) had no daily limit, so a student calling ai_reserve with their own token
--    could hold the institute budget with endless reservations. It now has its own daily counter `searches` (limit =
--    the student's doubts + step-by-step doubts a day: one search per doubt) and is refused to staff like the tutor.
--    A counter, not "one search per pending tutor call": a student can settle their own reservation as `error`, which
--    refunds its counter, so any pairing rule can be looped; with a counter the refund also releases the hold.
-- 2: a reservation left `pending` (server stopped mid-call) held its worst-case cost against the budget and the Bill
--    for ever. Reservations older than 1 hour are settled as `error` at cost 0, under the institute lock on the next
--    reservation and by the daily purge. 1 hour so a slow real call still settles (ai_finish needs `pending`).

alter table private.ai_features drop constraint ai_features_counter_key_check,
  add constraint ai_features_counter_key_check
    check (counter_key in ('messages', 'premium_messages', 'generations', 'searches'));
alter table public.usage_counters drop constraint usage_counters_counter_key_check,
  add constraint usage_counters_counter_key_check
    check (counter_key in ('messages', 'premium_messages', 'generations', 'searches'));
update private.ai_features set counter_key = 'searches' where feature = 'query_embed';

create index usage_records_pending on public.usage_records (institute_id, created_at) where outcome = 'pending';

-- Same as Phase 5 plus the stale-reservation sweep (2) and the `searches` limit (1).
create or replace function private.ai_take(inst uuid, uid uuid, feat text, prov text, mdl text, reserve bigint, job uuid)
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

  -- shortcut: a stale student call keeps its daily counter (it resets at midnight anyway).
  update public.usage_records set outcome = 'error', settled_at = now()
  where institute_id = inst and outcome = 'pending' and created_at < now() - interval '1 hour';

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

-- The search belongs to the tutor, which is a student tool (ADR-039), so staff cannot spend the budget on it either.
create or replace function private.ai_reserve(inst uuid, feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.member_id(inst) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if (feat in ('question_gen', 'notes_gen') and not private.has_role(inst, '{owner,admin,teacher}'))
     or (feat in ('tutor', 'tutor_premium', 'generation', 'query_embed') and not private.has_role(inst, '{student}')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from private.ai_take(inst, (select auth.uid()), feat, prov, mdl, reserve, null);
end $$;

-- Daily purge (ADR-029/031) also settles stale reservations of institutes that made no AI call since.
create or replace function private.purge_expired() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare m bigint; c bigint; u bigint; d bigint; r bigint;
begin
  delete from public.messages where created_at < now() - interval '12 months';
  get diagnostics m = row_count;
  delete from public.conversations x where x.created_at < now() - interval '12 months'
    and not exists (select 1 from public.messages where conversation_id = x.id);
  get diagnostics c = row_count;
  delete from public.usage_counters where day < (now() at time zone 'Asia/Kolkata')::date - 35;
  get diagnostics u = row_count;
  delete from public.documents x where x.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.document_versions v join storage.objects o
                    on o.bucket_id = 'documents' and o.name = v.storage_path where v.document_id = x.id);
  get diagnostics d = row_count;
  update public.usage_records set outcome = 'error', settled_at = now()
  where outcome = 'pending' and created_at < now() - interval '1 hour';
  get diagnostics r = row_count;
  return jsonb_build_object('messages', m, 'conversations', c, 'usage_counters', u, 'documents', d,
                            'stale_reservations', r);
end $$;
