-- R1.2 (founder, 2026-10-18): a teacher's own uploaded notes need no check. The upload records the subject's batch
-- as the audience; when the worker makes the first version current, the document publishes itself. AI notes
-- (kind 'ai_notes') stay drafts until the teacher reads and publishes them (ADR-039).
create or replace function private.guard_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.current_version_id is null and new.current_version_id is not null
     and new.status = 'draft' and new.kind = 'file' then
    new.status := 'published';
  end if;
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
