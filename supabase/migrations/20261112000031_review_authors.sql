-- Founder (2026-10-18, ADR-047): a student who hid their name still reads the reply. The author of every review is
-- kept in private.review_authors, which no API role can read; only private.my_reviews() uses it, and only for the
-- caller's own rows. The institute (owner/admin, any API read) still cannot tell who wrote an anonymous review.
create table private.review_authors (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade
);
revoke all on private.review_authors from public, anon, authenticated, worker;
-- Named reviews sent before this: their author is already known. Anonymous ones before this had none stored.
insert into private.review_authors (review_id, user_id) select id, user_id from public.reviews where user_id is not null;

-- Written for every new review from the session (never from the request). No session (fixtures, scripts) = no row.
create function private.record_review_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    insert into private.review_authors (review_id, user_id) values (new.id, (select auth.uid()));
  end if;
  return null;
end $$;
create trigger record_author after insert on public.reviews
  for each row execute function private.record_review_author();

-- The caller's own reviews in this institute (named and anonymous) with the institute's reply.
create function private.my_reviews(inst uuid)
returns table (id uuid, body text, anonymous boolean, created_at timestamptz, reply text, replied_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.body, r.user_id is null, r.created_at, r.reply, r.replied_at
  from public.reviews r join private.review_authors a on a.review_id = r.id
  where a.user_id = (select auth.uid()) and r.institute_id = inst and private.member_id(inst) is not null
  order by r.created_at desc
  limit 50 $$;
create function public.my_reviews(inst uuid)
returns table (id uuid, body text, anonymous boolean, created_at timestamptz, reply text, replied_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.my_reviews(inst) $$;

revoke execute on function private.record_review_author(), private.my_reviews(uuid), public.my_reviews(uuid) from public;
grant execute on function private.my_reviews(uuid), public.my_reviews(uuid) to authenticated;

-- Replaced by my_reviews (which also covers anonymous reviews).
drop policy reviews_own_read on public.reviews;
