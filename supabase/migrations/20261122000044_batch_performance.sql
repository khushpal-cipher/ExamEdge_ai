-- Batch C2: whole-batch Performance tab (staff). Existing attempts, answers, doubts and practice only; no AI cost.
-- Callers: owner/admin of the institute, or a teacher of the batch (private.teaches_batch).
-- "Needs attention" = average below 50% (at least one test counted) or no activity for 5 days (founder, 2026-10-29).
create function private.batch_performance(inst uuid, batch uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.batches b where b.id = batch and b.institute_id = inst)
     or not private.teaches_batch(batch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with studs as (
    select m.user_id from public.batch_members bm join public.memberships m on m.id = bm.membership_id
    where bm.batch_id = batch and bm.batch_role = 'student' and bm.left_at is null and m.status = 'active'),
  released as (
    select t.id, t.title, t.closes_at from public.tests t join public.test_audience ta on ta.test_id = t.id
    where ta.batch_id = batch and t.institute_id = inst and t.status = 'results_released'),
  trend as (
    select r.id, r.title, r.closes_at, count(a.id) as takers,
           round(avg(100.0 * a.score / nullif(a.max_score, 0)), 2) as average
    from released r left join public.test_attempts a on a.test_id = r.id and a.user_id in (select user_id from studs)
    group by r.id, r.title, r.closes_at),
  topics as (
    select s.name as subject, coalesce(c.name, 'No chapter') as chapter, count(*) as answers,
           round(100 * sum(coalesce(aa.marks_awarded, 0)) / nullif(sum(tq.marks), 0), 2) as percentage
    from released r join public.test_attempts a on a.test_id = r.id and a.user_id in (select user_id from studs)
    join public.test_questions tq on tq.test_id = r.id
    join public.questions q on q.id = tq.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.chapters c on c.id = q.chapter_id
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
    group by s.name, c.name),
  seen as (
    select u.user_id, greatest(
      (select max(a.started_at) from public.test_attempts a where a.user_id = u.user_id and a.institute_id = inst),
      (select max(m.created_at) from public.conversations c join public.messages m on m.conversation_id = c.id and m.role = 'user'
        where c.institute_id = inst and c.user_id = u.user_id),
      (select max(p.completed_at) from public.practice_attempts p where p.institute_id = inst and p.user_id = u.user_id)
    ) as last_at
    from studs u),
  people as (
    select u.user_id, s.average_percentage, coalesce(s.tests_counted, 0) as tests_counted, e.last_at,
           (coalesce(s.tests_counted, 0) > 0 and s.average_percentage < 50)
             or e.last_at is null or e.last_at < now() - interval '5 days' as attention
    from studs u join seen e on e.user_id = u.user_id
    left join public.batch_standings s on s.batch_id = batch and s.user_id = u.user_id)
  select jsonb_build_object(
    'students', (select count(*) from studs),
    'active_week', (select count(*) from seen where last_at >= now() - interval '7 days'),
    'tests_released', (select count(*) from released),
    'average', (select round(avg(average_percentage), 2) from people where tests_counted > 0),
    'attention', (select count(*) from people where attention),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'closes_at', closes_at, 'takers', takers,
                         'average', average) order by closes_at) from trend), '[]'),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'chapter', chapter,
                         'percentage', percentage) order by percentage, subject, chapter)
                        from topics where answers >= 3), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'average', average_percentage,
                         'tests_counted', tests_counted, 'last_at', last_at, 'attention', attention)) from people), '[]'))
  into result;
  return result;
end $$;

create function public.batch_performance(inst uuid, batch uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.batch_performance(inst, batch) $$;

revoke execute on function private.batch_performance(uuid, uuid), public.batch_performance(uuid, uuid) from public, anon;
grant execute on function private.batch_performance(uuid, uuid), public.batch_performance(uuid, uuid) to authenticated;
