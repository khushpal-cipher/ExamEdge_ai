begin;
select plan(4);
select has_extension('vector', 'pgvector installed');
select has_schema('private', 'private schema exists');
-- ADR-019: API roles may use `private` only to run allowlisted helper functions; its tables stay closed.
select is_empty($$
  select c.relname from pg_class c where c.relnamespace = 'private'::regnamespace and c.relkind in ('r', 'p', 'v')
    and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) $$,
  'anon/authenticated have no privileges on private tables');
select ok(not has_function_privilege('anon', 'private.has_role(uuid, text[])', 'execute'),
  'anon cannot execute private helpers other than resolve_institute');
select * from finish();
rollback;
