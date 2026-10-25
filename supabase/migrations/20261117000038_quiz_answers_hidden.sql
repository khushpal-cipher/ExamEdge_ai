-- Code review 9: a student could read a published practice quiz's answers through the API before trying it, because
-- `content` carried them. Nobody reads `content` directly any more: artifact_content() hands it out, and for a quiz it
-- drops `answer` and `explanation` unless the caller is staff or has already tried the quiz (they are shown after a try).
-- A table-level SELECT hides nothing from a column revoke, so SELECT is re-granted column by column (all but content).
revoke select on public.generated_artifacts from authenticated;
grant select (id, institute_id, owner_scope, owner_user_id, kind, subject_id, chapter_id, source_refs, input_hash,
  prompt_version, model, schema_version, status, usage_record_id, created_by, approved_by, approved_at, created_at,
  updated_at) on public.generated_artifacts to authenticated;

create function private.artifact_content(a uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.generated_artifacts;
begin
  select * into g from public.generated_artifacts where id = a;
  if g.id is null or not private.can_read_artifact(a) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if g.kind = 'quiz' and not private.has_role(g.institute_id, '{owner,admin,teacher}')
     and not exists (select 1 from public.practice_attempts p where p.artifact_id = a and p.user_id = (select auth.uid())) then
    return jsonb_set(g.content, '{questions}',
      coalesce((select jsonb_agg(q - 'answer' - 'explanation') from jsonb_array_elements(g.content -> 'questions') q), '[]'));
  end if;
  return g.content;
end $$;
create function public.artifact_content(a uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.artifact_content(a) $$;
revoke execute on function private.artifact_content(uuid), public.artifact_content(uuid) from public;
grant execute on function private.artifact_content(uuid), public.artifact_content(uuid) to authenticated;
