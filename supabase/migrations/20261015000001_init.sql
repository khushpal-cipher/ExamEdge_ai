-- Phase 1: extensions and the private schema (never exposed through the Data API).
create extension if not exists vector with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Worker role: RLS applies (NOBYPASSRLS). Tenant context is set per transaction with
-- set_config('app.institute_id', id, true). Login/password is configured outside migrations.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'worker') then
    create role worker nologin nobypassrls;
  end if;
end $$;
grant usage on schema public, extensions to worker;

-- Heartbeat proves the worker can reach the database (Phase 1 AC1.4, local part).
create table private.worker_heartbeats (
  id bigint generated always as identity primary key,
  beat_at timestamptz not null default now()
);
grant usage on schema private to worker;
grant insert, select on private.worker_heartbeats to worker;
