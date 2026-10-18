-- Founder (2026-10-18, ADR-047): owner/admin reply to a review; the student reads replies to the reviews they sent
-- with their name (an anonymous review has no author stored, so its reply is seen by owner/admin only).
alter table public.reviews
  add column reply text check (char_length(reply) between 1 and 2000), -- null = no reply (or reply removed)
  add column replied_at timestamptz,
  add column replied_by uuid references auth.users (id) on delete set null;

-- Who and when come from the session, never from the request.
create function private.stamp_review_reply() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.replied_by := case when new.reply is null then null else (select auth.uid()) end;
  new.replied_at := case when new.reply is null then null else now() end;
  return new;
end $$;
create trigger stamp_reply before update of reply on public.reviews
  for each row execute function private.stamp_review_reply();
revoke execute on function private.stamp_review_reply() from public;

grant update (reply) on public.reviews to authenticated;
create policy reviews_manager_reply on public.reviews for update to authenticated
  using (private.has_role(institute_id, '{owner,admin}'))
  with check (private.has_role(institute_id, '{owner,admin}'));
create policy reviews_own_read on public.reviews for select to authenticated
  using (user_id = (select auth.uid()) and private.member_id(institute_id) is not null);
