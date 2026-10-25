-- Code review 10: a file uploaded bigger than its declared size fails with `too_large` but stayed in storage for
-- good, because its failed version still pointed at it. A failed oversized upload is now purgeable after the 1-day wait.
create or replace function private.purgeable(bucket text, object_name text, created timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select created < now() - interval '1 day' and case bucket
    when 'documents' then not exists (
      select 1 from public.document_versions v join public.documents d on d.id = v.document_id
      where v.storage_path = object_name and (d.deleted_at is null or d.deleted_at >= now() - interval '30 days')
        and not (v.processing_status = 'failed' and v.error_code = 'too_large'))
    when 'logos' then not exists (select 1 from public.institutes i where i.branding ->> 'logo' = object_name)
    else false end
$$;
