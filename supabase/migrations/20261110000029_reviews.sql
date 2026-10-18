-- Founder (2026-10-18, ADR-047): students write reviews of their coaching; only the institute's owner/admin read
-- them (teachers never). A student may hide their name: then user_id is not stored at all, so nobody (owner,
-- platform, a database read) can tell who wrote it. The batch is kept so the owner knows which class it is about.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  batch_id uuid not null,
  user_id uuid references auth.users (id) on delete set null, -- null = anonymous
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (institute_id, batch_id) references public.batches (institute_id, id) on delete cascade
);
create index on public.reviews (institute_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
grant insert (institute_id, batch_id, user_id, body) on public.reviews to authenticated;

-- A student writes about a batch they are in (current or past), under their own id or none.
create policy reviews_student_insert on public.reviews for insert to authenticated
  with check (private.has_role(institute_id, '{student}') and private.in_batch(batch_id)
              and (user_id is null or user_id = (select auth.uid())));
create policy reviews_manager_read on public.reviews for select to authenticated
  using (private.has_role(institute_id, '{owner,admin}'));
