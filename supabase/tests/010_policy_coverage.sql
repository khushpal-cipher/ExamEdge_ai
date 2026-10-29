-- T-ISO-05 / AC2.1 / gate G1: structural guarantees that hold for every current and future table and function.
-- Extension-owned objects (pgTAP is installed into public while tests run) are excluded.
begin;
select plan(9);

create temp view our_tables as
  select c.oid, c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
create temp view our_functions as
  select p.oid, p.proname, p.pronamespace, p.prosecdef, p.proconfig from pg_proc p
  where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select is_empty($$ select t.relname from pg_temp.our_tables t join pg_class c on c.oid = t.oid where not c.relrowsecurity $$,
  'every public table has RLS enabled');

select is_empty($$ select relname from pg_temp.our_tables t
  where not exists (select 1 from pg_policy p where p.polrelid = t.oid) $$,
  'every public table has at least one policy');

-- audit_events keeps rows of deleted institutes and platform actions, so its institute_id is nullable; no API role
-- can write it directly.
select is_empty($$ select relname from pg_temp.our_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attname = 'institute_id'
  where not a.attnotnull and t.relname <> 'audit_events' $$,
  'every tenant table has institute_id not null');

select is_empty($$ select relname from pg_temp.our_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attname = 'institute_id'
  where has_column_privilege('authenticated', t.oid, a.attnum, 'UPDATE')
     or has_column_privilege('anon', t.oid, a.attnum, 'UPDATE') $$,
  'no API role can move a row to another institute');

select is_empty($$ select relname from pg_temp.our_tables t
  where has_table_privilege('anon', t.oid, 'TRUNCATE,TRIGGER')
     or has_table_privilege('authenticated', t.oid, 'TRUNCATE,TRIGGER') $$,
  'no API role has TRUNCATE or TRIGGER (they ignore RLS)');

select is_empty($$ select proname from pg_temp.our_functions
  where pronamespace = 'public'::regnamespace and prosecdef $$,
  'no SECURITY DEFINER function in the exposed public schema');

select set_eq($$ select proname::text from pg_temp.our_functions
  where pronamespace = 'private'::regnamespace and prosecdef $$,
  array['is_platform_admin', 'has_role', 'member_id', 'in_batch', 'teaches_batch', 'teaches_member', 'has_subject',
        'shares_institute_as_staff', 'handle_new_user', 'audit_row', 'guard_membership_update', 'guard_batch_member',
        'resolve_institute', 'create_invitation', 'accept_invitation', 'create_institute',
        'can_see_test', 'can_manage_test', 'test_is_draft', 'can_grade', 'guard_question', 'guard_question_key',
        'guard_test', 'compute_standings', 'compute_results', 'start_attempt', 'get_attempt_questions', 'save_answer',
        'submit_attempt', 'get_attempt_review', 'grade_answer', 'release_results', 'student_progress',
        'can_read_document', 'can_read_object', 'pending_jobs', 'ai_reserve', 'ai_settle', 'ai_reserve_job',
        'ai_settle_job', 'ai_globally_enabled', 'set_ai_enabled', 'report_answer', 'tutor_activity',
        'can_read_artifact',
        'submit_practice', 'practice_activity', 'guard_upload', 'job_slot_free', 'purge_expired', 'purgeable', 'is_service_account',
        'purgeable_files', 'delete_institute', 'reinvite_owner', 'inr_per_usd', 'set_inr_per_usd',
        'record_review_author', 'my_reviews', 'cbt_warning', 'batch_standing_count', 'artifact_content',
        'read_only', 'guard_read_only', 'seats_full', 'guard_seats', 'set_member_name',
        'account_count', 'apply_limits', 'on_accounts_change', 'topup_micro', 'bill_quote', 'start_payment', 'submit_utr',
        'batch_performance', 'approve_payment', 'reject_payment', 'add_price_list', 'gst_number', 'set_gst_number', 'billing_status'],
  'SECURITY DEFINER functions match the reviewed allowlist');

select is_empty($$ select proname from pg_temp.our_functions
  where not coalesce(proconfig @> array['search_path=""'], false) $$,
  'every function in public/private pins search_path to empty');

select is_empty($$ select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'every public view is security_invoker');

select * from finish();
rollback;
