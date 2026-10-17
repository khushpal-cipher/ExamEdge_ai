-- R1.1 step 5 (ADR-039): teachers' AI = AI notes + AI test; the tutor and Studio are students' tools.
-- AI notes are stored as a document whose file is Markdown, so publish / withdraw / retrieval reuse the notes path.

-- ---------------------------------------------------------------- who may spend AI on what
-- One AI-notes call (Sonnet, ≤ 16,000 output tokens): worst case ≈ 0.2 USD.
insert into private.ai_features values ('notes_gen', 'member', null, 500000);

create or replace function private.ai_reserve(inst uuid, feat text, prov text, mdl text, reserve bigint)
returns table (record_id uuid, blocked text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.member_id(inst) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  -- Writing questions and notes is staff work; the tutor and Studio are for students (ADR-039), so neither side can
  -- spend the institute budget on the other's features.
  if (feat in ('question_gen', 'notes_gen') and not private.has_role(inst, '{owner,admin,teacher}'))
     or (feat in ('tutor', 'tutor_premium', 'generation') and not private.has_role(inst, '{student}')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from private.ai_take(inst, (select auth.uid()), feat, prov, mdl, reserve, null);
end $$;

-- ---------------------------------------------------------------- AI notes = a Markdown document
alter table public.document_versions drop constraint document_versions_mime_check,
  add constraint document_versions_mime_check
    check (mime in ('application/pdf', 'image/png', 'image/jpeg', 'text/markdown'));
update storage.buckets set allowed_mime_types = '{application/pdf,image/png,image/jpeg,text/markdown}'
  where id = 'documents';

-- 'ai_notes' opens as an in-app notes page (students cannot read versions, so the kind lives on the document).
alter table public.documents add column kind text not null default 'file' check (kind in ('file', 'ai_notes'));
grant insert (kind) on public.documents to authenticated;

-- ---------------------------------------------------------------- AI test = a new draft test
-- Stores one AI test in one transaction: the questions (as add_ai_questions does, plus `marks` per item), a draft test
-- for the subject's own batch and its question list. Invoker: RLS decides (a teacher only for a batch they teach),
-- the triggers keep AI questions as drafts, and scheduling refuses the test until every question is approved.
create function public.add_ai_test(inst uuid, subject uuid, chapter uuid, title text, opens timestamptz,
                                   closes timestamptz, seconds int, items jsonb) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  batch uuid;
  t uuid;
  q jsonb;
  qid uuid;
  n int := 0;
begin
  select s.batch_id into batch from public.subjects s where s.institute_id = inst and s.id = subject;
  if batch is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds)
  values (inst, title, opens, closes, seconds) returning id into t;
  insert into public.test_audience (test_id, batch_id, institute_id) values (t, batch, inst);
  for q in select value from jsonb_array_elements(items) loop
    insert into public.questions (institute_id, subject_id, chapter_id, type, stem, options, explanation, difficulty,
                                  origin, verification)
    values (inst, subject, chapter, q ->> 'type', q ->> 'stem', coalesce(q -> 'options', '[]'),
            coalesce(q ->> 'explanation', ''), coalesce(q ->> 'difficulty', 'medium'), 'ai', q ->> 'verification')
    returning id into qid;
    insert into public.question_keys (question_id, institute_id, key, second_solve)
    values (qid, inst, q -> 'key', nullif(q -> 'second_solve', 'null'));
    n := n + 1;
    insert into public.test_questions (test_id, question_id, institute_id, position, marks, negative_marks)
    values (t, qid, inst, n, coalesce((q ->> 'marks')::numeric, 4), 0);
  end loop;
  return t;
end $$;

revoke execute on function public.add_ai_test(uuid, uuid, uuid, text, timestamptz, timestamptz, int, jsonb)
  from public;
grant execute on function public.add_ai_test(uuid, uuid, uuid, text, timestamptz, timestamptz, int, jsonb)
  to authenticated;
