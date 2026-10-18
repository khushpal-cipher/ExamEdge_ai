-- R1.1 step 6 (ADR-040): the student's batch switcher shows "my own time" in one batch.
-- The three progress functions take an optional batch (null = all batches, as before; teachers' view unchanged).
-- student_progress also skips tests opened after the student left a batch, the same rule as compute_standings.

drop function public.student_progress(uuid, uuid);
drop function private.student_progress(uuid, uuid);
drop function public.tutor_activity(uuid, uuid);
drop function private.tutor_activity(uuid, uuid);
drop function public.practice_activity(uuid, uuid);
drop function private.practice_activity(uuid, uuid);

create function private.student_progress(inst uuid, student uuid, batch uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  mid uuid;
  result jsonb;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with my_batches as (
    select bm.batch_id, bm.created_at as joined_at, bm.left_at from public.batch_members bm
    where bm.membership_id = mid and bm.batch_role = 'student' and (batch is null or bm.batch_id = batch)),
  tests as (
    select distinct t.id, t.title, t.closes_at,
           (select sum(marks) from public.test_questions where test_id = t.id) as max_marks
    from public.tests t join public.test_audience ta on ta.test_id = t.id
    join my_batches b on b.batch_id = ta.batch_id and t.closes_at > b.joined_at
                     and (b.left_at is null or t.opens_at < b.left_at)
    where t.institute_id = inst and t.status = 'results_released'),
  answers as (
    select a.test_id, a.user_id, q.type, q.subject_id, q.chapter_id, tq.marks, coalesce(aa.marks_awarded, 0) as got,
           aa.teacher_comment, q.stem
    from tests t join public.test_attempts a on a.test_id = t.id
    join public.test_questions tq on tq.test_id = t.id
    join public.questions q on q.id = tq.question_id
    left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id),
  mine as (select * from answers where user_id = student),
  test_rows as (
    select t.id, t.title, t.closes_at, t.max_marks, a.score, a.rank, a.percentile,
           extract(epoch from a.submitted_at - a.started_at)::int as seconds,
           a.id is null as missed,
           (select sum(got) from mine m where m.test_id = t.id and m.type <> 'written') as objective,
           (select sum(got) from mine m where m.test_id = t.id and m.type = 'written') as written,
           (select count(*) from public.test_attempts x where x.test_id = t.id) as takers,
           (select round(avg(score), 2) from public.test_attempts x where x.test_id = t.id) as batch_average,
           (select max(score) from public.test_attempts x where x.test_id = t.id) as highest
    from tests t left join public.test_attempts a on a.test_id = t.id and a.user_id = student)
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object('batch', b.name, 'overall_rank', s.overall_rank,
               'average_percentage', s.average_percentage, 'tests_counted', s.tests_counted,
               'tests_missed', s.tests_missed,
               'batch_size', (select count(*) from public.batch_standings z where z.batch_id = s.batch_id))
               order by b.name)
      from public.batch_standings s join public.batches b on b.id = s.batch_id
      where s.user_id = student and s.batch_id in (select batch_id from my_batches)), '[]'),
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'closes_at', r.closes_at,
               'max_marks', r.max_marks, 'score', r.score, 'rank', r.rank, 'percentile', r.percentile,
               'takers', r.takers, 'seconds', r.seconds, 'missed', r.missed, 'objective', r.objective,
               'written', r.written, 'batch_average', r.batch_average, 'highest', r.highest) order by r.closes_at)
      from test_rows r), '[]'),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object('subject', s.name, 'chapter', coalesce(c.name, 'No chapter'),
               'marks', x.got, 'max_marks', x.max) order by s.name, c.position, c.name)
      from (select subject_id, chapter_id, sum(got) as got, sum(marks) as max from mine
            group by subject_id, chapter_id) x
      join public.subjects s on s.id = x.subject_id left join public.chapters c on c.id = x.chapter_id), '[]'),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'marks', got, 'max_marks', max, 'negative', neg) order by type)
      from (select type, sum(got) as got, sum(marks) as max, -sum(least(got, 0)) as neg from mine group by type) x),
      '[]'),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('subject', s.name,
               'percentage', round(100 * m.got / nullif(m.max, 0), 2),
               'batch_percentage', round(100 * b.got / nullif(b.max, 0), 2)) order by s.name)
      from (select subject_id, sum(got) as got, sum(marks) as max from mine group by subject_id) m
      join (select subject_id, sum(got) as got, sum(marks) as max from answers group by subject_id) b
        on b.subject_id = m.subject_id
      join public.subjects s on s.id = m.subject_id), '[]'),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('test', t.title, 'question', left(m.stem, 200), 'comment', m.teacher_comment)
               order by t.closes_at)
      from mine m join tests t on t.id = m.test_id where m.teacher_comment is not null), '[]'))
  into result;
  return result;
end $$;

-- Doubts asked per subject (counts only, never text). A subject belongs to one batch (ADR-038).
create function private.tutor_activity(inst uuid, student uuid, batch uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mid uuid;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('subject', s.name, 'doubts', x.n, 'last_at', x.last_at) order by s.name)
    from (select c.subject_id, count(*) as n, max(m.created_at) as last_at
          from public.conversations c join public.messages m on m.conversation_id = c.id and m.role = 'user'
          where c.institute_id = inst and c.user_id = student group by c.subject_id) x
    join public.subjects s on s.id = x.subject_id
    where batch is null or s.batch_id = batch), '[]');
end $$;

-- Practice per topic (counts, average, last try).
create function private.practice_activity(inst uuid, student uuid, batch uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mid uuid;
begin
  select id into mid from public.memberships where institute_id = inst and user_id = student and role = 'student';
  if mid is null or not (
       (student = (select auth.uid()) and private.has_role(inst, '{student}'))
       or private.has_role(inst, '{owner,admin}')
       or (private.has_role(inst, '{teacher}') and private.teaches_member(mid))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('subject', s.name, 'chapter', c.name, 'quizzes', x.n,
                                        'average', x.average, 'last_at', x.last_at) order by s.name, c.position, c.name)
    from (select g.chapter_id, count(*) as n, round(avg(100.0 * p.score / p.max_score), 2) as average,
                 max(p.completed_at) as last_at
          from public.practice_attempts p join public.generated_artifacts g on g.id = p.artifact_id
          where p.institute_id = inst and p.user_id = student group by g.chapter_id) x
    join public.chapters c on c.id = x.chapter_id
    join public.subjects s on s.id = c.subject_id
    where batch is null or s.batch_id = batch), '[]');
end $$;

create function public.student_progress(inst uuid, student uuid, batch uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.student_progress(inst, student, batch) $$;
create function public.tutor_activity(inst uuid, student uuid, batch uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.tutor_activity(inst, student, batch) $$;
create function public.practice_activity(inst uuid, student uuid, batch uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.practice_activity(inst, student, batch) $$;

revoke execute on function private.student_progress(uuid, uuid, uuid), private.tutor_activity(uuid, uuid, uuid),
  private.practice_activity(uuid, uuid, uuid), public.student_progress(uuid, uuid, uuid),
  public.tutor_activity(uuid, uuid, uuid), public.practice_activity(uuid, uuid, uuid) from public, anon;
grant execute on function private.student_progress(uuid, uuid, uuid), private.tutor_activity(uuid, uuid, uuid),
  private.practice_activity(uuid, uuid, uuid), public.student_progress(uuid, uuid, uuid),
  public.tutor_activity(uuid, uuid, uuid), public.practice_activity(uuid, uuid, uuid) to authenticated;
