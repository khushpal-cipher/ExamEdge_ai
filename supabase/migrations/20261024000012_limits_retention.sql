-- Phase 10 (local parts): per-institute upload, storage and job limits (deferred in ADR-025) and the retention purge
-- (DATABASE_DESIGN §4.4, §4.6). ADR-029.

-- ---------------------------------------------------------------- upload + storage limits
-- Checked when the upload starts (the row carries the size the browser declared); the worker then refuses a file
-- larger than that declared size, so the real file can never exceed the limit.
create function private.guard_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
declare q public.institute_quotas;
begin
  select * into q from public.institute_quotas where institute_id = new.institute_id;
  if new.size_bytes > q.max_upload_bytes then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;
  -- One upload start at a time per institute, so two parallel uploads cannot both squeeze under the storage cap.
  perform pg_advisory_xact_lock(hashtextextended('upload:' || new.institute_id::text, 0));
  if (select coalesce(sum(size_bytes), 0) from public.document_versions where institute_id = new.institute_id)
     + new.size_bytes > q.max_storage_bytes then
    raise exception 'storage_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_upload before insert on public.document_versions
  for each row execute function private.guard_upload();

-- ---------------------------------------------------------------- job concurrency
-- A version counts as running while its claim is fresh (a claim older than 30 minutes = dead worker, re-run).
-- pending_jobs hands out at most max_concurrent_jobs per institute, so one institute's 500 uploads cannot starve the
-- others; job_slot_free is the strict check at claim time (holds even with several workers).
create or replace function private.pending_jobs() returns table (institute_id uuid, version_id uuid)
language sql stable security definer set search_path = '' as $$
  with waiting as (
    select v.institute_id, v.id, v.created_at,
      row_number() over (partition by v.institute_id order by v.created_at) as n
    from public.document_versions v
    where v.processing_status = 'queued'
       or (v.processing_status = 'processing' and v.claimed_at < now() - interval '30 minutes')
  )
  select w.institute_id, w.id from waiting w
  join public.institute_quotas q on q.institute_id = w.institute_id
  where w.n + (select count(*) from public.document_versions r
               where r.institute_id = w.institute_id and r.processing_status = 'processing'
                 and r.claimed_at >= now() - interval '30 minutes') <= q.max_concurrent_jobs
  order by w.created_at
  limit 100
$$;

-- Called by the worker inside its tenant transaction right before claiming; the lock lasts until that transaction
-- ends, so two workers cannot both take the last slot.
create function private.job_slot_free() returns boolean
language plpgsql security definer set search_path = '' as $$
declare inst uuid := private.job_institute();
begin
  if inst is null then raise exception 'no_tenant_context' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('jobs:' || inst::text, 0));
  return (select count(*) from public.document_versions
          where institute_id = inst and processing_status = 'processing'
            and claimed_at >= now() - interval '30 minutes')
       < (select max_concurrent_jobs from public.institute_quotas where institute_id = inst);
end $$;

-- ---------------------------------------------------------------- retention purge (daily worker job)
-- Chat messages are kept 12 months (ADR-026, Q-06 pending legal advice); a chat with no messages left goes too.
-- Daily counters are only needed for today's limit; 35 days keeps a month of history for support questions.
-- Returns counts only (no ids, no text) for the job log.
create function private.purge_expired() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m bigint; c bigint; u bigint;
begin
  delete from public.messages where created_at < now() - interval '12 months';
  get diagnostics m = row_count;
  delete from public.conversations x where x.created_at < now() - interval '12 months'
    and not exists (select 1 from public.messages where conversation_id = x.id);
  get diagnostics c = row_count;
  delete from public.usage_counters where day < (now() at time zone 'Asia/Kolkata')::date - 35;
  get diagnostics u = row_count;
  return jsonb_build_object('messages', m, 'conversations', c, 'usage_counters', u);
end $$;

revoke execute on function private.guard_upload(), private.job_slot_free(), private.purge_expired() from public;
grant execute on function private.job_slot_free(), private.purge_expired() to worker;
