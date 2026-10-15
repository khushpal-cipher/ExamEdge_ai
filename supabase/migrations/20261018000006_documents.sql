-- Phase 4: documents, versions, audience, chunks, private storage, worker access (DATABASE_DESIGN §4.3, AI_PIPELINE §3,
-- ADR-024). Web never enqueues jobs: it moves a version to `queued`; the worker finds it through private.pending_jobs()
-- and processes it inside a transaction with set_config('app.institute_id', id, true), so RLS limits it to one tenant.

-- ---------------------------------------------------------------- tables
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes on delete cascade,
  subject_id uuid not null,
  chapter_id uuid,
  title text not null check (length(title) between 1 and 200),
  current_version_id uuid,
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  published_at timestamptz,
  withdrawn_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade,
  foreign key (institute_id, chapter_id) references public.chapters (institute_id, id) on delete set null (chapter_id)
);
create index on public.documents (institute_id, subject_id) where deleted_at is null;

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null,
  document_id uuid not null,
  version int not null check (version > 0),
  storage_path text not null unique,
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  sha256 text,
  page_count int,
  processing_status text not null default 'uploading'
    check (processing_status in ('uploading', 'queued', 'processing', 'ready', 'failed')),
  error_code text,
  extraction_method text check (extraction_method in ('text_layer', 'ocr', 'mixed')),
  chunker_version int,
  embedding_model text,
  claimed_at timestamptz,
  processed_at timestamptz,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version),
  unique (institute_id, id),
  unique (institute_id, document_id, id),
  foreign key (institute_id, document_id) references public.documents (institute_id, id) on delete cascade,
  -- The object name is fixed by the row, so a policy that matches on it cannot be pointed at another tenant's file.
  check (storage_path = institute_id::text || '/' || document_id::text || '/' || id::text)
);
create index document_versions_pending on public.document_versions (processing_status)
  where processing_status in ('queued', 'processing');

-- The current version must be a version of this same document.
alter table public.documents add foreign key (institute_id, id, current_version_id)
  references public.document_versions (institute_id, document_id, id);

create table public.document_audience (
  document_id uuid not null,
  batch_id uuid not null,
  institute_id uuid not null,
  primary key (document_id, batch_id),
  foreign key (institute_id, document_id) references public.documents (institute_id, id) on delete cascade,
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade
);
create index on public.document_audience (batch_id);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  institute_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  subject_id uuid not null,
  chunk_index int not null check (chunk_index >= 0),
  page_start int not null,
  page_end int not null,
  heading_path text,
  content text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding extensions.vector(1024) not null,
  token_count int not null,
  unique (document_version_id, chunk_index),
  foreign key (institute_id, document_id) references public.documents (institute_id, id) on delete cascade,
  foreign key (institute_id, document_version_id) references public.document_versions (institute_id, id)
    on delete cascade,
  check (page_end >= page_start)
);
-- No HNSW index: retrieval is exact distance over one subject of one institute (ADR-006).
create index on public.document_chunks (institute_id, subject_id, document_id);
create index on public.document_chunks using gin (tsv);

-- Worker service account(s): a Supabase Auth user the worker signs in as to download queued files (no secret key).
create table private.service_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  kind text not null check (kind = 'worker')
);
alter table private.service_accounts enable row level security;

-- ---------------------------------------------------------------- helpers
create function private.job_institute() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.institute_id', true), '')::uuid
$$;

create function private.can_read_document(doc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc and d.deleted_at is null
      and (private.has_role(d.institute_id, '{owner,admin,teacher}')
           or (d.status = 'published' and exists (
                 select 1 from public.document_audience a
                 where a.document_id = d.id and private.in_batch(a.batch_id)))))
$$;

-- Storage read: staff read any version of their institute; readers of a document read its current version only;
-- the worker account reads only files that are waiting to be processed.
create function private.can_read_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v join public.documents d on d.id = v.document_id
    where v.storage_path = object_name
      and (private.has_role(v.institute_id, '{owner,admin,teacher}')
           or (d.current_version_id = v.id and private.can_read_document(d.id))
           or (v.processing_status in ('queued', 'processing')
               and exists (select 1 from private.service_accounts s where s.user_id = (select auth.uid())))))
$$;

-- Ids only, across tenants: the worker cannot see any tenant row without a tenant context, so it asks here.
-- `processing` older than 30 minutes = the worker died mid-job; it is picked up again (sweeper).
create function private.pending_jobs() returns table (institute_id uuid, version_id uuid)
language sql stable security definer set search_path = '' as $$
  select v.institute_id, v.id from public.document_versions v
  where v.processing_status = 'queued'
     or (v.processing_status = 'processing' and v.claimed_at < now() - interval '30 minutes')
  order by v.created_at
  limit 100
$$;

-- ---------------------------------------------------------------- triggers
-- API users may only queue a version (after upload, retry after failure, or reprocess); the worker does the rest.
create function private.guard_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.processing_status is distinct from old.processing_status
     and not (old.processing_status in ('uploading', 'failed', 'ready') and new.processing_status = 'queued') then
    raise exception 'invalid_status_change' using errcode = '42501';
  end if;
  if new.processing_status = 'queued' then new.error_code := null; end if;
  return new;
end $$;
create trigger guard before update on public.document_versions
  for each row execute function private.guard_version();

create function private.guard_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.current_version_id is null then
    raise exception 'document_not_ready' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'published' then new.published_at := now(); new.withdrawn_at := null;
    elsif new.status = 'withdrawn' then new.withdrawn_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger guard before update on public.documents
  for each row execute function private.guard_document();

create trigger audit after insert or update or delete on public.documents
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.document_audience
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- retrieval (Phase 6 tutor; T-ISO-06 proves it now)
-- SECURITY INVOKER: RLS on documents and chunks decides what the caller can retrieve. Exact cosine top-k and
-- keyword top-k over the caller's readable, published chunks of one subject, fused by reciprocal rank.
create function public.match_chunks(query_embedding extensions.vector, query_text text, subject uuid, k int default 30)
returns table (id bigint, document_id uuid, page_start int, page_end int, heading_path text, content text,
               score double precision)
language sql stable security invoker set search_path = '' as $$
  with pool as (
    select c.* from public.document_chunks c join public.documents d on d.id = c.document_id
    where c.subject_id = subject and d.status = 'published' and d.deleted_at is null
  ),
  vec as (
    select p.id, row_number() over (order by p.embedding operator(extensions.<=>) query_embedding) as r
    from pool p order by p.embedding operator(extensions.<=>) query_embedding limit k
  ),
  kw as (
    select p.id, row_number() over (order by ts_rank(p.tsv, q) desc) as r
    from pool p, websearch_to_tsquery('simple', query_text) q
    where p.tsv @@ q order by ts_rank(p.tsv, q) desc limit k
  ),
  fused as (
    select f.id, sum(1.0 / (60 + f.r))::double precision as score
    from (select * from vec union all select * from kw) f group by f.id
  )
  select p.id, p.document_id, p.page_start, p.page_end, p.heading_path, p.content, f.score
  from fused f join pool p on p.id = f.id
  order by f.score desc
  limit k
$$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function private.job_institute(), private.can_read_document(uuid), private.can_read_object(text),
  private.pending_jobs(), private.guard_version(), private.guard_document(),
  public.match_chunks(extensions.vector, text, uuid, int) from public;
grant execute on function private.can_read_document(uuid), private.can_read_object(text),
  public.match_chunks(extensions.vector, text, uuid, int) to authenticated;
grant execute on function private.job_institute(), private.pending_jobs() to worker;

-- ---------------------------------------------------------------- RLS + privileges (API users)
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_audience enable row level security;
alter table public.document_chunks enable row level security;
revoke all on public.documents, public.document_versions, public.document_audience, public.document_chunks
  from anon, authenticated;

grant select, insert (institute_id, subject_id, chapter_id, title), update (title, chapter_id, status, deleted_at)
  on public.documents to authenticated;
-- Staff inline (not only via the helper): a definer helper cannot see the row inside its own insert … returning.
create policy documents_read on public.documents for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') or private.can_read_document(id));
create policy documents_insert on public.documents for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy documents_update on public.documents for update to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));

grant select, insert (id, institute_id, document_id, version, storage_path, mime, size_bytes),
  update (processing_status) on public.document_versions to authenticated;
create policy versions_read on public.document_versions for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy versions_insert on public.document_versions for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy versions_update on public.document_versions for update to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}'));

-- Teachers publish only to batches they teach (teaches_batch is also true for owner/admin).
grant select, insert (document_id, batch_id, institute_id), delete on public.document_audience to authenticated;
create policy audience_read on public.document_audience for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy audience_insert on public.document_audience for insert to authenticated
  with check (private.has_role(institute_id, '{owner,admin,teacher}') and private.teaches_batch(batch_id));
create policy audience_delete on public.document_audience for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}') and private.teaches_batch(batch_id));

grant select, delete on public.document_chunks to authenticated;
create policy chunks_read on public.document_chunks for select to authenticated
  using (private.can_read_document(document_id));
create policy chunks_delete on public.document_chunks for delete to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));

-- ---------------------------------------------------------------- worker (RLS applies; one tenant per transaction)
grant select, update (current_version_id) on public.documents to worker;
grant select, update (processing_status, error_code, sha256, page_count, extraction_method, chunker_version,
  embedding_model, claimed_at, processed_at) on public.document_versions to worker;
grant select, insert (institute_id, document_id, document_version_id, subject_id, chunk_index, page_start, page_end,
  heading_path, content, embedding, token_count), delete on public.document_chunks to worker;
create policy documents_worker on public.documents for all to worker
  using (institute_id = private.job_institute()) with check (institute_id = private.job_institute());
create policy versions_worker on public.document_versions for all to worker
  using (institute_id = private.job_institute()) with check (institute_id = private.job_institute());
create policy chunks_worker on public.document_chunks for all to worker
  using (institute_id = private.job_institute()) with check (institute_id = private.job_institute());

-- ---------------------------------------------------------------- storage
-- Private bucket; object name = document_versions.storage_path = {institute_id}/{document_id}/{version_id}.
-- Logos are public (shown on the sign-in page) and written only by platform admins with MFA.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 52428800, '{application/pdf,image/png,image/jpeg}'),
  ('logos', 'logos', true, 1048576, '{image/png,image/jpeg,image/webp}');

create policy documents_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and exists (
    select 1 from public.document_versions v
    where v.storage_path = objects.name and v.processing_status = 'uploading'
      and private.has_role(v.institute_id, '{owner,admin,teacher}')));
create policy documents_download on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.can_read_object(name));
create policy logos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and private.is_platform_admin());

-- Branding: colour and an optional logo object inside the institute's own folder of the logos bucket.
alter table public.institutes drop constraint branding_shape;
alter table public.institutes add constraint branding_shape check (
  jsonb_typeof(branding) = 'object'
  and (not branding ? 'color' or branding ->> 'color' ~ '^#[0-9a-f]{6}$')
  and (not branding ? 'logo' or branding ->> 'logo' ~ ('^' || id::text || '/[0-9a-f-]{36}$'))
  and branding - 'color' - 'logo' = '{}'::jsonb);

-- ---------------------------------------------------------------- fix: institute delete must cascade (DATABASE_DESIGN §7)
-- ON DELETE RESTRICT on questions blocked deleting an institute. The FKs now cascade, and the existing question guard
-- refuses to delete a question used in any test unless its institute is being deleted (graded answers depend on it).
-- Same error code as before (23503), so the UI still says "still used somewhere".
alter table public.test_questions drop constraint test_questions_institute_id_question_id_fkey,
  add foreign key (institute_id, question_id) references public.questions (institute_id, id) on delete cascade;
alter table public.attempt_answers drop constraint attempt_answers_institute_id_question_id_fkey,
  add foreign key (institute_id, question_id) references public.questions (institute_id, id) on delete cascade;

create or replace function private.guard_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.test_questions where question_id = old.id)
       and exists (select 1 from public.institutes where id = old.institute_id) then
      raise exception 'question_used_in_test' using errcode = '23503';
    end if;
    return old;
  end if;
  if (new.stem, new.options, new.type) is distinct from (old.stem, old.options, old.type) and exists (
       select 1 from public.test_questions tq join public.tests t on t.id = tq.test_id
       where tq.question_id = old.id and t.status <> 'draft') then
    raise exception 'question_in_use' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_delete before delete on public.questions
  for each row execute function private.guard_question();
