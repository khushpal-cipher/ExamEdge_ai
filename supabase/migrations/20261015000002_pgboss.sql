-- pg-boss lives in its own schema owned by the worker role (not exposed through the Data API).
grant worker to postgres;
create schema if not exists pgboss authorization worker;
revoke all on schema pgboss from public, anon, authenticated;
