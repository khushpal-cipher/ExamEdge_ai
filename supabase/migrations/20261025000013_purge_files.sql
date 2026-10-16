-- Purge of files nobody can reach any more (closes the ADR-029 gap, ADR-031). Postgres may not delete Storage objects
-- itself (storage.protect_delete), so the worker deletes them through the Storage API as its service account; these
-- policies let it delete exactly the objects private.purgeable() names, and nothing else.

-- A file is purgeable once it is more than a day old (an upload or a logo change may still be in flight) and:
--  documents: no version of a live document, or of one deleted less than 30 days ago, points at it (deleted
--             documents past their 30-day grace, and files left behind by a deleted institute);
--  logos:     no institute's branding uses it (replaced logos, deleted institutes).
create function private.purgeable(bucket text, object_name text, created timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select created < now() - interval '1 day' and case bucket
    when 'documents' then not exists (
      select 1 from public.document_versions v join public.documents d on d.id = v.document_id
      where v.storage_path = object_name and (d.deleted_at is null or d.deleted_at >= now() - interval '30 days'))
    when 'logos' then not exists (select 1 from public.institutes i where i.branding ->> 'logo' = object_name)
    else false end
$$;

create function private.is_service_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.service_accounts where user_id = (select auth.uid()))
$$;

-- The worker's list for the daily purge job (≤ 1,000 per run; the rest goes the next day).
create function private.purgeable_files() returns table (bucket text, name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where o.bucket_id in ('documents', 'logos') and private.purgeable(o.bucket_id, o.name, o.created_at)
  order by o.created_at limit 1000
$$;

revoke execute on function private.purgeable(text, text, timestamptz), private.is_service_account(),
  private.purgeable_files() from public;
grant execute on function private.purgeable(text, text, timestamptz), private.is_service_account()
  to authenticated;
grant execute on function private.purgeable_files() to worker;

-- Storage's delete runs "delete … returning", so the service account needs to see the rows it deletes.
create policy purge_select on storage.objects for select to authenticated
  using ((select private.is_service_account()) and private.purgeable(bucket_id, name, created_at));
create policy purge_delete on storage.objects for delete to authenticated
  using ((select private.is_service_account()) and private.purgeable(bucket_id, name, created_at));

-- Daily purge, now also hard-deleting documents past their 30-day grace once their files are gone (chunks,
-- versions and audience rows cascade). Run after the files are deleted; a document whose files remain waits.
create or replace function private.purge_expired() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m bigint; c bigint; u bigint; d bigint;
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
  return jsonb_build_object('messages', m, 'conversations', c, 'usage_counters', u, 'documents', d);
end $$;
