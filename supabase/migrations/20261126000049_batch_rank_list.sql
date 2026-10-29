-- Student Home: the whole batch's rank list (rank, name, average, which row is mine). Founder 2026-10-29: names shown.
create function private.batch_rank_list(batch uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.in_batch(batch) or private.teaches_batch(batch)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('rank', s.overall_rank, 'average', s.average_percentage,
             'name', coalesce(p.full_name, 'Unnamed'), 'me', s.user_id = (select auth.uid())) order by s.overall_rank, s.user_id)
    from public.batch_standings s left join public.profiles p on p.user_id = s.user_id
    where s.batch_id = batch and s.overall_rank is not null), '[]');
end $$;
create function public.batch_rank_list(batch uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.batch_rank_list(batch) $$;
revoke execute on function private.batch_rank_list(uuid), public.batch_rank_list(uuid) from public, anon;
grant execute on function private.batch_rank_list(uuid), public.batch_rank_list(uuid) to authenticated;
