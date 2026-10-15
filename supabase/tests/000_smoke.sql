begin;
select plan(4);
select has_extension('vector', 'pgvector installed');
select has_schema('private', 'private schema exists');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon cannot use private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated cannot use private schema');
select * from finish();
rollback;
