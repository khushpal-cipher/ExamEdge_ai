-- Phase 8 (AC8.4): the keyword half of hybrid retrieval ANDed every word of the question
-- (websearch_to_tsquery), so "what is the angle of repose" matched nothing and only the vector half ranked.
-- Now: OR of the question's content words; English stop words (ts_lexize returns '{}') are dropped.
-- A question made only of stop words gives null → the keyword half is empty, the vector half still ranks.
create function private.keyword_query(q text) returns tsquery
language sql stable security invoker set search_path = '' as $$
  -- websearch syntax never raises on odd input; ltrim keeps a lexeme like '-5' from becoming NOT 5
  select websearch_to_tsquery('simple', string_agg(ltrim(w.lexeme, '-'), ' or '))
  from unnest(to_tsvector('simple', coalesce(q, ''))) w
  where ts_lexize('english_stem', w.lexeme) is distinct from '{}'::text[]
$$;
revoke execute on function private.keyword_query(text) from public;
grant execute on function private.keyword_query(text) to authenticated;

create or replace function public.match_chunks(query_embedding extensions.vector, query_text text, subject uuid,
                                               k int default 30)
returns table (id bigint, institute_id uuid, document_id uuid, page_start int, page_end int, heading_path text,
               content text, similarity double precision, score double precision)
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
    from pool p, private.keyword_query(query_text) q
    where p.tsv @@ q order by ts_rank(p.tsv, q) desc limit k
  ),
  fused as (
    select f.id, sum(1.0 / (60 + f.r))::double precision as score
    from (select * from vec union all select * from kw) f group by f.id
  )
  select p.id, p.institute_id, p.document_id, p.page_start, p.page_end, p.heading_path, p.content,
         1 - (p.embedding operator(extensions.<=>) query_embedding), f.score
  from fused f join pool p on p.id = f.id
  order by f.score desc
  limit k
$$;

create or replace function public.match_library_chunks(query_embedding extensions.vector, query_text text,
                                                       subject uuid, k int default 20)
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
    from pool p, private.keyword_query(query_text) q
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
