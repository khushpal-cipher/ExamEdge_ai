-- LOCAL/CI ONLY: pgTAP helpers loaded as a seed file (supabase/config.toml [db.seed]); never pushed to a cloud project.
-- Fixtures follow TEST_STRATEGY §2: two institutes with identical structure + an outsider.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(email text) returns uuid language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', email, now(),
          jsonb_build_object('full_name', split_part(email, '@', 1)), now(), now())
  returning id
$$;

-- Act as a signed-in user (RLS applies). aal2 = completed MFA.
create or replace function tests.login(email text, aal text default 'aal1') returns void language plpgsql as $$
declare u uuid;
begin
  reset role;
  select id into strict u from auth.users where auth.users.email = login.email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated', 'email', email, 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.as_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Institute <slug> on host <slug>.localhost. Batch X: teacher1, student1, student2, subject Physics.
-- Batch Y: teacher2, student3, subject Chemistry. Pending invitation token = 'tok-<slug>'.
create or replace function tests.make_institute(slug text) returns uuid language plpgsql as $$
declare
  inst uuid; bx uuid; by_ uuid; sp uuid; sc uuid; m uuid; who text;
begin
  insert into public.institutes (slug, name) values (slug, initcap(slug) || ' Classes') returning id into inst;
  insert into public.institute_domains (hostname, institute_id) values (slug || '.localhost', inst);
  insert into public.batches (institute_id, name) values (inst, 'Batch X') returning id into bx;
  insert into public.batches (institute_id, name) values (inst, 'Batch Y') returning id into by_;
  insert into public.subjects (institute_id, name) values (inst, 'Physics') returning id into sp;
  insert into public.subjects (institute_id, name) values (inst, 'Chemistry') returning id into sc;
  insert into public.batch_subjects (batch_id, subject_id, institute_id) values (bx, sp, inst), (by_, sc, inst);
  insert into public.chapters (institute_id, subject_id, name) values (inst, sp, 'Rotation'), (inst, sc, 'Bonding');
  foreach who in array array['owner', 'admin', 'teacher1', 'teacher2', 'student1', 'student2', 'student3'] loop
    insert into public.memberships (institute_id, user_id, role)
    values (inst, tests.create_user(who || '@' || slug || '.test'), regexp_replace(who, '\d', ''))
    returning id into m;
    if who in ('teacher1', 'student1', 'student2') then
      insert into public.batch_members values (bx, m, inst, regexp_replace(who, '\d', ''));
    elsif who in ('teacher2', 'student3') then
      insert into public.batch_members values (by_, m, inst, regexp_replace(who, '\d', ''));
    end if;
  end loop;
  insert into public.invitations (institute_id, email, role, batch_id, token_hash)
  values (inst, 'new@' || slug || '.test', 'student', bx, sha256(convert_to('tok-' || slug, 'UTF8')));
  insert into public.consent_records (user_id, kind, policy_version, method)
  values ((select id from auth.users where email = 'student1@' || slug || '.test'), 'terms', 'v1', 'test');
  return inst;
end $$;

create or replace function tests.setup() returns void language plpgsql as $$
begin
  perform tests.make_institute('alpha');
  perform tests.make_institute('bravo');
  perform tests.create_user('outsider@nowhere.test');
end $$;

-- Definer so tests can look up ids while acting as any role (tests schema only exists locally/CI).
create or replace function tests.inst(slug text) returns uuid language sql stable security definer
set search_path = '' as $$ select id from public.institutes where institutes.slug = inst.slug $$;
create or replace function tests.uid(email text) returns uuid language sql stable security definer
set search_path = '' as $$ select id from auth.users where users.email = uid.email $$;

-- Rows affected by a DML statement, run as the current role.
create or replace function tests.affected(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function tests.mid(email text) returns uuid language sql stable security definer
set search_path = '' as $$
  select m.id from public.memberships m join auth.users u on u.id = m.user_id where u.email = mid.email
$$;
