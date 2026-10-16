-- Phase 6: AI tutor (DATABASE_DESIGN §4.4, ADR-026). Conversations and messages are student-private (class S):
-- only their owner reads or writes them, staff see counts only. A reported answer is copied into answer_reports
-- by the student's own action, so teachers can review it without reading the rest of the chat.

-- ---------------------------------------------------------------- tables
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade
);
create index on public.conversations (institute_id, user_id, created_at desc);
create index on public.conversations (institute_id, subject_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  -- [{source_kind, document_id, page_start, page_end, cited_text}] and [{label, citations: [index]}] per paragraph.
  citations jsonb not null default '[]' check (jsonb_typeof(citations) = 'array'),
  answer_labels jsonb not null default '[]' check (jsonb_typeof(answer_labels) = 'array'),
  model text,
  usage_record_id uuid,
  feedback text check (feedback in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (institute_id, id),
  foreign key (institute_id, conversation_id) references public.conversations (institute_id, id) on delete cascade
);
create index on public.messages (conversation_id, created_at);

-- A copy made when the student taps "Report": it survives the student deleting the chat, and staff never see who
-- reported it (no column grant on reported_by).
create table public.answer_reports (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  subject_id uuid not null,
  message_id uuid unique,
  reported_by uuid not null references auth.users (id) on delete cascade,
  question text not null,
  answer text not null,
  citations jsonb not null default '[]',
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  foreign key (institute_id, subject_id) references public.subjects (institute_id, id) on delete cascade,
  foreign key (institute_id, message_id) references public.messages (institute_id, id) on delete set null (message_id)
);
create index on public.answer_reports (institute_id, resolved_at, created_at desc);

-- ---------------------------------------------------------------- RLS (owner only; staff read reports)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.answer_reports enable row level security;
revoke all on public.conversations, public.messages, public.answer_reports from anon, authenticated;

grant select, insert (institute_id, subject_id, title), delete on public.conversations to authenticated;
-- Subjects RLS applies inside the check: a student can only open a chat on a subject of their own batches.
create policy conversations_own on public.conversations for all to authenticated
  using (user_id = (select auth.uid()) and private.member_id(institute_id) is not null)
  with check (user_id = (select auth.uid()) and private.member_id(institute_id) is not null
              and exists (select 1 from public.subjects s where s.institute_id = conversations.institute_id
                                                          and s.id = conversations.subject_id));

grant select, insert (institute_id, conversation_id, role, content, citations, answer_labels, model, usage_record_id),
  update (feedback) on public.messages to authenticated;
create policy messages_own on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id
                   and c.institute_id = messages.institute_id and c.user_id = (select auth.uid()))
         and private.member_id(institute_id) is not null)
  with check (exists (select 1 from public.conversations c where c.id = messages.conversation_id
                        and c.institute_id = messages.institute_id and c.user_id = (select auth.uid()))
              and private.member_id(institute_id) is not null);

grant select (id, institute_id, subject_id, message_id, question, answer, citations, reason, created_at, resolved_at),
  update (resolved_at, resolved_by) on public.answer_reports to authenticated;
create policy reports_staff_read on public.answer_reports for select to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'));
create policy reports_staff_resolve on public.answer_reports for update to authenticated
  using (private.has_role(institute_id, '{owner,admin,teacher}'))
  with check (private.has_role(institute_id, '{owner,admin,teacher}')
              and (resolved_by is null or resolved_by = (select auth.uid())));

-- ---------------------------------------------------------------- definers
-- Copies the reported answer and the question before it. Only the owner of the conversation can report.
create function private.report_answer(msg uuid, why text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.messages;
  c public.conversations;
  q text;
  rid uuid;
begin
  select * into m from public.messages where id = msg and role = 'assistant';
  select * into c from public.conversations where id = m.conversation_id;
  if m.id is null or c.user_id is distinct from (select auth.uid()) or private.member_id(c.institute_id) is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select content into q from public.messages
  where conversation_id = c.id and role = 'user' and created_at <= m.created_at
  order by created_at desc limit 1;
  insert into public.answer_reports (institute_id, subject_id, message_id, reported_by, question, answer, citations, reason)
  values (c.institute_id, c.subject_id, m.id, c.user_id, coalesce(q, ''), m.content, m.citations, left(why, 500))
  on conflict (message_id) do nothing
  returning id into rid;
  return rid;
end $$;

-- Doubts asked per subject (counts only, never text) for the progress page. Same callers as student_progress.
create function private.tutor_activity(inst uuid, student uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mid uuid;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('subject', s.name, 'doubts', x.n, 'last_at', x.last_at) order by s.name)
    from (select c.subject_id, count(*) as n, max(m.created_at) as last_at
          from public.conversations c join public.messages m on m.conversation_id = c.id and m.role = 'user'
          where c.institute_id = inst and c.user_id = student group by c.subject_id) x
    join public.subjects s on s.id = x.subject_id), '[]');
end $$;

create function public.report_answer(msg uuid, why text) returns uuid
language sql volatile security invoker set search_path = '' as $$ select private.report_answer(msg, why) $$;
create function public.tutor_activity(inst uuid, student uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.tutor_activity(inst, student) $$;

-- ---------------------------------------------------------------- retrieval: + institute_id and similarity
-- The tutor asserts every passage's institute before building a prompt (TH-06, defence in depth), and similarity
-- (1 - cosine distance) is kept for evals.
drop function public.match_chunks(extensions.vector, text, uuid, int);
create function public.match_chunks(query_embedding extensions.vector, query_text text, subject uuid, k int default 30)
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
    from pool p, websearch_to_tsquery('simple', query_text) q
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

-- ---------------------------------------------------------------- function privileges
revoke execute on function private.report_answer(uuid, text), private.tutor_activity(uuid, uuid),
  public.report_answer(uuid, text), public.tutor_activity(uuid, uuid),
  public.match_chunks(extensions.vector, text, uuid, int) from public;
grant execute on function private.report_answer(uuid, text), private.tutor_activity(uuid, uuid),
  public.report_answer(uuid, text), public.tutor_activity(uuid, uuid),
  public.match_chunks(extensions.vector, text, uuid, int) to authenticated;
