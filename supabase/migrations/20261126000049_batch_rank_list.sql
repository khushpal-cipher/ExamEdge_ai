-- Student Home: the whole batch's rank list without names (rank, average, which row is mine).
create function private.batch_rank_list(batch uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.in_batch(batch) or private.teaches_batch(batch)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('rank', overall_rank, 'average', average_percentage,
             'me', user_id = (select auth.uid())) order by overall_rank, user_id)
    from public.batch_standings where batch_id = batch and overall_rank is not null), '[]');
end $$;
create function public.batch_rank_list(batch uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.batch_rank_list(batch) $$;
revoke execute on function private.batch_rank_list(uuid), public.batch_rank_list(uuid) from public, anon;
grant execute on function private.batch_rank_list(uuid), public.batch_rank_list(uuid) to authenticated;
