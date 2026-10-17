-- R1.1 (ADR-038, ADR-040): Smart Study works per topic, and the owner moves students to their next batch.

-- ---------------------------------------------------------------- tutor chats per topic
-- Null = a chat from before R1.1 (subject-wide); new chats are always opened on a topic.
alter table public.conversations
  add column chapter_id uuid,
  add foreign key (institute_id, subject_id, chapter_id)
    references public.chapters (institute_id, subject_id, id) on delete cascade;
create index on public.conversations (institute_id, chapter_id);
grant insert (chapter_id) on public.conversations to authenticated;

-- Retrieval over one topic's notes (all its subtopics); null topic = the whole subject (old callers, evals).
drop function public.match_chunks(extensions.vector, text, uuid, int);
create function public.match_chunks(query_embedding extensions.vector, query_text text, subject uuid,
                                    k int default 30, topic uuid default null)
returns table (id bigint, institute_id uuid, document_id uuid, page_start int, page_end int, heading_path text,
               content text, similarity double precision, score double precision)
language sql stable security invoker set search_path = '' as $$
  with pool as (
    select c.* from public.document_chunks c join public.documents d on d.id = c.document_id
    where c.subject_id = subject and (topic is null or d.chapter_id = topic)
      and d.status = 'published' and d.deleted_at is null
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
revoke execute on function public.match_chunks(extensions.vector, text, uuid, int, uuid) from public;
grant execute on function public.match_chunks(extensions.vector, text, uuid, int, uuid) to authenticated;

-- ---------------------------------------------------------------- promotion (ADR-040)
-- One statement: the old rows get left_at (kept as history), the new batch gets the same students. Invoker, so RLS
-- decides: only owner/admin may update batch_members, and the composite FK refuses another institute's batch.
create function public.move_students(from_batch uuid, to_batch uuid, members uuid[]) returns int
language sql volatile security invoker set search_path = '' as $$
  with moved as (
    update public.batch_members set left_at = now()
    where batch_id = from_batch and batch_id <> to_batch and membership_id = any (members)
      and batch_role = 'student' and left_at is null
    returning institute_id, membership_id),
  added as (
    insert into public.batch_members (batch_id, membership_id, institute_id, batch_role)
    select to_batch, membership_id, institute_id, 'student' from moved
    on conflict (batch_id, membership_id) do update set left_at = null
    returning 1)
  select count(*)::int from added
$$;
revoke execute on function public.move_students(uuid, uuid, uuid[]) from public;
grant execute on function public.move_students(uuid, uuid, uuid[]) to authenticated;
