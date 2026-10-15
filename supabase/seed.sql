-- LOCAL DEVELOPMENT ONLY (applied by `supabase db reset`, never by `supabase db push`).
-- Staging/production set the worker password out of band.
alter role worker with login password 'worker_local_only';
