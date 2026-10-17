-- R1.1 group E (ADR-037, reverses ADR-010/ADR-027): ExamEdge shares no content with institutes. Drops the library
-- tables, its retrieval/publish functions and platform-level AI metering (feature library_embed).

drop function public.match_library_chunks(extensions.vector, text, uuid, int);
drop function public.publish_library_item(uuid, jsonb, text);
drop function private.publish_library_item(uuid, jsonb, text);
drop function public.ai_reserve_platform(text, text, text, bigint);
drop function public.ai_settle_platform(uuid, jsonb, bigint, text);
drop function private.ai_reserve_platform(text, text, text, bigint);
drop function private.ai_settle_platform(uuid, jsonb, bigint, text);

alter table public.subjects drop column library_subject_id;
drop table public.library_chunks, public.library_items, public.library_topics, public.library_chapters,
  public.library_subjects;
drop function private.guard_library_item();

-- Platform rows (institute null) only ever metered library embeddings; usage is per institute again.
delete from public.usage_records where institute_id is null;
alter table public.usage_records alter column institute_id set not null;
delete from private.ai_features where feature = 'library_embed';
alter table private.ai_features drop constraint ai_features_who_check;
alter table private.ai_features add constraint ai_features_who_check check (who in ('member', 'worker'));
