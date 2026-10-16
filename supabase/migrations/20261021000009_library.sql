-- Phase 8: the shared ExamEdge library (DATABASE_DESIGN §4.1, ADR-010, ADR-027). Global, ExamEdge-owned content in
-- the tree Exam → Subject → Chapter → Topic → items. Every signed-in user reads published items; only an aal2
-- platform admin writes. Institute data never flows in here (ADR-010).
-- AC8.2: nothing is published without a named reviewer (check constraint); the reviewer is always the caller (set by
-- the trigger, no column grant), and any edit of what students read sends the item back to draft.

-- ---------------------------------------------------------------- tree
create table public.library_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams on delete cascade,
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (exam_id, name)
);

create table public.library_chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.library_subjects on delete cascade,
  position int not null default 0,
  name text not null check (length(name) between 1 and 200),
  unique (subject_id, name)
);

create table public.library_topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.library_chapters on delete cascade,
  position int not null default 0,
  name text not null check (length(name) between 1 and 200),
  unique (chapter_id, name)
);
create index on public.library_topics (chapter_id, position);

-- ---------------------------------------------------------------- items
-- Text kinds only for now ({"body": Markdown + LaTeX}); question and flashcard kinds come with generation (Phase 9).
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.library_topics on delete cascade,
  kind text not null check (kind in ('explanation', 'formula_sheet', 'worked_example')),
  content jsonb not null check (jsonb_typeof(content -> 'body') = 'string'
                                and length(content ->> 'body') between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'retired')),
  version int not null default 1,
  provenance text not null check (length(provenance) between 10 and 1000), -- how it was made + rights basis (AC8.3)
  generated_by_model text check (length(generated_by_model) <= 80),
  created_by uuid default auth.uid() references auth.users on delete set null,
  reviewed_by uuid references auth.users, -- no cascade: a reviewer's account cannot vanish under their reviews
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (reviewed_by is not null and reviewed_at is not null))
);
create index on public.library_items (topic_id);

create function private.guard_library_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is null then return new; end if; -- ops scripts (seed) set every column themselves
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.version := 1;
    new.created_by := (select auth.uid());
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.published_at := null;
    return new;
  end if;
  new.version := old.version;
  new.created_by := old.created_by;
  -- A change to what students read needs a fresh review.
  if (new.content, new.kind, new.topic_id) is distinct from (old.content, old.kind, old.topic_id) then
    new.status := 'draft';
    new.version := old.version + 1;
  end if;
  if new.status = 'draft' then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.published_at := null;
  elsif new.status = 'reviewed' and old.status = 'draft' then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    if new.status = 'published' and old.status <> 'published' then new.published_at := now(); end if;
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.library_items
  for each row execute function private.guard_library_item();

-- ---------------------------------------------------------------- chunks (retrieval)
-- One shared, non-tenant corpus, so an HNSW index is fine here (ADR-006). Written only by publish_library_item.
create table public.library_chunks (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.library_items on delete cascade,
  subject_id uuid not null references public.library_subjects on delete cascade, -- denormalised retrieval filter
  chunk_index int not null check (chunk_index >= 0),
  content text not null check (length(content) between 1 and 8000),
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding extensions.vector(1024) not null,
  embedding_model text not null,
  unique (item_id, chunk_index)
);
create index on public.library_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index on public.library_chunks using gin (tsv);
create index on public.library_chunks (subject_id);

-- ---------------------------------------------------------------- institute subject → library subject
alter table public.subjects add column library_subject_id uuid references public.library_subjects on delete set null;
create index on public.subjects (library_subject_id);
grant update (library_subject_id) on public.subjects to authenticated; -- subjects_update: owner/admin only

-- ---------------------------------------------------------------- RLS
alter table public.library_subjects enable row level security;
alter table public.library_chapters enable row level security;
alter table public.library_topics enable row level security;
alter table public.library_items enable row level security;
alter table public.library_chunks enable row level security;
revoke all on public.library_subjects, public.library_chapters, public.library_topics, public.library_items,
  public.library_chunks from anon, authenticated;

grant select, insert (exam_id, name), update (name), delete on public.library_subjects to authenticated;
grant select, insert (subject_id, position, name), update (position, name), delete on public.library_chapters
  to authenticated;
grant select, insert (chapter_id, position, name), update (position, name), delete on public.library_topics
  to authenticated;
grant select, insert (topic_id, kind, content, provenance, generated_by_model),
  update (kind, content, status, provenance, generated_by_model), delete on public.library_items to authenticated;
grant select on public.library_chunks to authenticated;

create policy library_subjects_read on public.library_subjects for select to authenticated using (true);
create policy library_subjects_admin on public.library_subjects for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy library_chapters_read on public.library_chapters for select to authenticated using (true);
create policy library_chapters_admin on public.library_chapters for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy library_topics_read on public.library_topics for select to authenticated using (true);
create policy library_topics_admin on public.library_topics for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy library_items_read on public.library_items for select to authenticated
  using (status = 'published' or private.is_platform_admin());
create policy library_items_admin on public.library_items for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy library_chunks_read on public.library_chunks for select to authenticated
  using (exists (select 1 from public.library_items i where i.id = item_id and i.status = 'published')
         or private.is_platform_admin());

-- ---------------------------------------------------------------- publish (chunks + status in one transaction)
-- The web server chunks and embeds the item (metered as a platform call), then hands the chunks over here.
create function private.publish_library_item(item uuid, chunks jsonb, model text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  it public.library_items;
  subj uuid;
begin
  if not private.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select i.* into it from public.library_items i where i.id = item for update;
  if it.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if it.status = 'draft' then raise exception 'not_reviewed' using errcode = '23514'; end if;
  if jsonb_typeof(chunks) <> 'array' or jsonb_array_length(chunks) = 0 then
    raise exception 'no_chunks' using errcode = '22023';
  end if;
  select c.subject_id into subj from public.library_topics t join public.library_chapters c on c.id = t.chapter_id
  where t.id = it.topic_id;
  delete from public.library_chunks where item_id = item;
  insert into public.library_chunks (item_id, subject_id, chunk_index, content, embedding, embedding_model)
  select item, subj, (x.n - 1)::int, x.c ->> 'content', (x.c ->> 'embedding')::extensions.vector, model
  from jsonb_array_elements(chunks) with ordinality as x (c, n);
  update public.library_items set status = 'published' where id = item;
  insert into public.audit_events (institute_id, actor_user_id, actor_kind, action, target_type, target_id, metadata)
  values (null, (select auth.uid()), 'platform_admin', 'library.publish', 'library_items', item,
          jsonb_build_object('version', it.version, 'chunks', jsonb_array_length(chunks)));
end $$;

create function public.publish_library_item(item uuid, chunks jsonb, model text) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.publish_library_item(item, chunks, model) $$;

-- ---------------------------------------------------------------- retrieval
-- Same hybrid as match_chunks (vector + keyword, reciprocal rank fusion); RLS keeps it to published items.
-- Iterative scans keep the HNSW top-k full when the subject filter and RLS drop rows (pgvector ≥ 0.8).
create function public.match_library_chunks(query_embedding extensions.vector, query_text text, subject uuid,
                                            k int default 20)
returns table (id bigint, item_id uuid, topic text, kind text, content text, similarity double precision,
               score double precision)
language sql stable security invoker set search_path = '' set hnsw.iterative_scan = 'relaxed_order' as $$
  with pool as (
    select c.* from public.library_chunks c where c.subject_id = subject
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
  select p.id, p.item_id, t.name, i.kind, p.content,
         1 - (p.embedding operator(extensions.<=>) query_embedding), f.score
  from fused f join pool p on p.id = f.id
  join public.library_items i on i.id = p.item_id
  join public.library_topics t on t.id = i.topic_id
  order by f.score desc
  limit k
$$;

-- ---------------------------------------------------------------- platform-level AI metering (ADR-027)
-- Library work belongs to no institute, so its usage rows have institute_id null; only platform admins read them
-- (usage_read policy). The global kill switch applies; there is no platform budget yet (provider spend limits, BLOCKED).
alter table public.usage_records alter column institute_id drop not null;
alter table private.ai_features drop constraint ai_features_who_check;
alter table private.ai_features add constraint ai_features_who_check check (who in ('member', 'worker', 'platform'));
insert into private.ai_features values ('library_embed', 'platform', null, 1000000);

-- Same as Phase 5 except that a platform record (institute null) matches inst = null.
create or replace function private.ai_finish(inst uuid, uid uuid, rid uuid, usage jsonb, cost bigint, result text)
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
  where u.id = rid and u.institute_id is not distinct from inst and u.user_id is not distinct from uid
    and u.outcome = 'pending'
  returning * into r;
  if r is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if result = 'error' and r.counter_key is not null then
    update public.usage_counters c set value = greatest(c.value - 1, 0)
    where c.institute_id = inst and c.user_id = uid and c.counter_key = r.counter_key
      and c.day = (r.created_at at time zone 'Asia/Kolkata')::date;
  end if;
end $$;

create function private.ai_reserve_platform(feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  f private.ai_features;
  why text;
  rid uuid;
begin
  if not private.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into f from private.ai_features where feature = feat;
  if f is null or f.who <> 'platform' then raise exception 'unknown_feature' using errcode = '22023'; end if;
  if reserve < 0 or reserve > f.max_reserve_micro_usd then
    raise exception 'reserve_out_of_range' using errcode = '22023';
  end if;
  if not (select s.ai_enabled from private.settings s) then why := 'ai_disabled'; end if;
  insert into public.usage_records (institute_id, user_id, feature, provider, model, reserved_micro_usd, outcome,
                                    settled_at)
  values (null, (select auth.uid()), feat, prov, mdl, case when why is null then reserve else 0 end,
          case when why is null then 'pending' else 'quota_blocked' end, case when why is null then null else now() end)
  returning id into rid;
  return query select rid, why;
end $$;

create function private.ai_settle_platform(rid uuid, usage jsonb, cost bigint, result text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform private.ai_finish(null, (select auth.uid()), rid, usage, cost, result);
end $$;

create function public.ai_reserve_platform(feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language sql volatile security invoker set search_path = '' as $$
  select * from private.ai_reserve_platform(feat, prov, mdl, reserve) $$;
create function public.ai_settle_platform(rid uuid, usage jsonb, cost bigint, result text) returns void
language sql volatile security invoker set search_path = '' as $$
  select private.ai_settle_platform(rid, usage, cost, result) $$;

-- ---------------------------------------------------------------- function privileges
revoke execute on function private.guard_library_item(), private.publish_library_item(uuid, jsonb, text),
  public.publish_library_item(uuid, jsonb, text),
  public.match_library_chunks(extensions.vector, text, uuid, int),
  private.ai_reserve_platform(text, text, text, bigint), private.ai_settle_platform(uuid, jsonb, bigint, text),
  public.ai_reserve_platform(text, text, text, bigint), public.ai_settle_platform(uuid, jsonb, bigint, text)
  from public;
grant execute on function private.guard_library_item(), private.publish_library_item(uuid, jsonb, text),
  public.publish_library_item(uuid, jsonb, text),
  public.match_library_chunks(extensions.vector, text, uuid, int),
  private.ai_reserve_platform(text, text, text, bigint), private.ai_settle_platform(uuid, jsonb, bigint, text),
  public.ai_reserve_platform(text, text, text, bigint), public.ai_settle_platform(uuid, jsonb, bigint, text)
  to authenticated;
