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
-- Batch Y: teacher2, student3, subject Chemistry. Topics Rotation (subtopic Torque) and Bonding.
-- Pending invitation token = 'tok-<slug>'.
create or replace function tests.make_institute(slug text) returns uuid language plpgsql as $$
declare
  inst uuid; bx uuid; by_ uuid; sp uuid; sc uuid; m uuid; who text; s1 uuid; q uuid; t uuid; att uuid; d uuid; v uuid;
  cv uuid; am uuid; ch uuid; qa uuid; st uuid;
begin
  insert into public.institutes (slug, name) values (slug, initcap(slug) || ' Classes') returning id into inst;
  insert into public.institute_domains (hostname, institute_id) values (slug || '.localhost', inst);
  insert into public.batches (institute_id, name) values (inst, 'Batch X') returning id into bx;
  insert into public.batches (institute_id, name) values (inst, 'Batch Y') returning id into by_;
  insert into public.subjects (institute_id, batch_id, name) values (inst, bx, 'Physics') returning id into sp;
  insert into public.subjects (institute_id, batch_id, name) values (inst, by_, 'Chemistry') returning id into sc;
  insert into public.chapters (institute_id, subject_id, name) values (inst, sp, 'Rotation') returning id into ch;
  insert into public.chapters (institute_id, subject_id, name) values (inst, sc, 'Bonding');
  insert into public.subtopics (institute_id, subject_id, chapter_id, name) values (inst, sp, ch, 'Torque')
  returning id into st;
  foreach who in array array['owner', 'admin', 'teacher1', 'teacher2', 'student1', 'student2', 'student3'] loop
    insert into public.memberships (institute_id, user_id, role)
    values (inst, tests.create_user(who || '@' || slug || '.test'), regexp_replace(who, '\d', ''))
    returning id into m;
    if who = 'student1' then s1 := m; end if;
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
  -- One released test in Batch X with student1's attempt (Phase 7 tables). It closed before anyone joined, so it never
  -- counts towards overall rank in tests that recompute standings.
  insert into public.questions (institute_id, subject_id, type, stem, options)
  values (inst, sp, 'single', 'Fixture question', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]') returning id into q;
  insert into public.question_keys values (q, inst, '{"correct":["a"]}');
  insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status)
  values (inst, 'Fixture test', now() - interval '2 days', now() - interval '1 day', 3600, 'results_released')
  returning id into t;
  insert into public.test_questions (test_id, question_id, institute_id) values (t, q, inst);
  insert into public.test_audience values (t, bx, inst);
  insert into public.test_attempts (institute_id, test_id, user_id, membership_id, started_at, deadline_at, submitted_at,
                                    status, question_order)
  select inst, t, user_id, s1, now() - interval '2 days', now() - interval '2 days' + interval '1 hour',
         now() - interval '2 days' + interval '30 minutes', 'submitted', array[q]
  from public.memberships where id = s1
  returning id into att;
  insert into public.attempt_answers (attempt_id, question_id, institute_id, response) values (att, q, inst, '["a"]');
  insert into public.batch_standings (batch_id, user_id, institute_id)
  select bx, user_id, inst from public.memberships where id = s1;
  -- Phase 4: "Physics notes" published to Batch X with one processed version and one chunk carrying a canary
  -- phrase unique to this institute (T-ISO-06).
  insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title)
  values (inst, sp, ch, st, 'Physics notes') returning id into d;
  v := gen_random_uuid();
  insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes,
                                        processing_status)
  values (v, inst, d, 1, inst || '/' || d || '/' || v, 'application/pdf', 1000, 'ready');
  update public.documents set current_version_id = v, status = 'published' where id = d;
  insert into public.document_audience values (d, bx, inst);
  insert into public.document_chunks (institute_id, document_id, document_version_id, subject_id, chunk_index,
                                      page_start, page_end, content, embedding, token_count)
  values (inst, d, v, sp, 0, 1, 1, 'Torque notes canary ' || slug || 'zebra',
          ('[' || repeat('0.1,', 1023) || '0.1]')::extensions.vector, 6);
  -- Phase 5: one settled tutor call by student1 and its daily counter.
  insert into public.usage_records (institute_id, user_id, feature, provider, model, counter_key, reserved_micro_usd,
                                    cost_micro_usd, outcome, settled_at)
  select inst, user_id, 'tutor', 'fake', 'fake', 'messages', 100, 0, 'ok', now() from public.memberships where id = s1;
  insert into public.usage_counters (institute_id, user_id, day, counter_key, value)
  select inst, user_id, (now() at time zone 'Asia/Kolkata')::date, 'messages', 1 from public.memberships where id = s1;
  -- Phase 6: student1's Physics chat (one question, one answer) and a report of that answer.
  insert into public.conversations (institute_id, user_id, subject_id, title)
  select inst, user_id, sp, 'What is torque?' from public.memberships where id = s1 returning id into cv;
  insert into public.messages (institute_id, conversation_id, role, content, created_at)
  values (inst, cv, 'user', 'What is torque? private ' || slug, now() - interval '1 minute');
  insert into public.messages (institute_id, conversation_id, role, content, model)
  values (inst, cv, 'assistant', 'Torque is the turning effect of a force.', 'fake-tutor-1') returning id into am;
  insert into public.answer_reports (institute_id, subject_id, message_id, reported_by, question, answer)
  select inst, sp, am, user_id, 'What is torque?', 'Torque is the turning effect of a force.'
  from public.memberships where id = s1;
  insert into public.reviews (institute_id, batch_id, body) values (inst, bx, 'Review of ' || slug); -- ADR-047
  -- Phase 9: a practice quiz published to Batch X, student1's own flashcards and one graded try of the quiz.
  insert into public.generated_artifacts (institute_id, owner_scope, kind, subject_id, chapter_id, input_hash,
                                          prompt_version, model, content, status, approved_at)
  values (inst, 'institute', 'quiz', sp, ch, repeat('a', 64), 'studio-v1', 'fake-studio-1',
          '{"questions":[{"id":"q1","stem":"Torque is a ___ quantity","options":[{"id":"a","text":"vector"},
            {"id":"b","text":"scalar"},{"id":"c","text":"unitless"},{"id":"d","text":"imaginary"}],"answer":"a",
            "explanation":"Torque has a direction.","cites":[0]},
            {"id":"q2","stem":"SI unit of torque","options":[{"id":"a","text":"N"},{"id":"b","text":"N m"},
            {"id":"c","text":"J/s"},{"id":"d","text":"kg"}],"answer":"b","explanation":"Force times distance.",
            "cites":[0]}]}', 'published', now())
  returning id into qa;
  insert into public.artifact_audience values (qa, bx, inst);
  insert into public.generated_artifacts (institute_id, owner_scope, owner_user_id, kind, subject_id, chapter_id,
                                          input_hash, prompt_version, model, content)
  select inst, 'student', user_id, 'flashcards', sp, ch, repeat('b', 64), 'studio-v1', 'fake-studio-1',
         jsonb_build_object('cards', jsonb_build_array(jsonb_build_object(
           'front', 'Torque private ' || slug, 'back', 'Turning effect', 'cites', jsonb_build_array(0))))
  from public.memberships where id = s1;
  insert into public.practice_attempts (institute_id, user_id, artifact_id, answers, score, max_score)
  select inst, user_id, qa, '{"q1":"a","q2":"a"}', 1, 2 from public.memberships where id = s1;
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

-- Id of the row in public.<tbl> whose <col> equals <val> (definer: usable while acting as any role).
create or replace function tests.id_of(tbl text, col text, val text) returns uuid language plpgsql stable
security definer set search_path = '' as $$
declare r uuid;
begin
  execute format('select id from public.%I where %I = $1', tbl, col) into r using val;
  return r;
end $$;

create or replace function tests.attempt(test_title text, email text) returns uuid language sql stable
security definer set search_path = '' as $$
  select a.id from public.test_attempts a join public.tests t on t.id = a.test_id join auth.users u on u.id = a.user_id
  where t.title = test_title and u.email = attempt.email
$$;

create or replace function tests.email(uid uuid) returns text language sql stable security definer
set search_path = '' as $$ select email from auth.users where id = uid $$;
