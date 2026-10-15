-- T-ISO-02 / AC2.2 / gate G2: every persona of institute alpha (plus an outsider and anon) × every tenant table
-- of institute bravo × select/insert/update/delete → nothing visible, nothing written.
-- Tables are read from the catalog, so a new tenant table is covered without editing this file.
-- Insert/update use only the columns the role is granted, so RLS (not a missing grant) must be what denies.
begin;
select tests.setup();
select * from no_plan();

create function pg_temp.matrix() returns setof text language plpgsql as $$
declare
  b uuid := tests.inst('bravo');
  personas text[] := array['owner@alpha.test', 'admin@alpha.test', 'teacher1@alpha.test', 'student1@alpha.test',
                           'outsider@nowhere.test', 'anon'];
  persona text; api_role text; t record; brow jsonb; cols text; ucol text; n bigint; outcome text;
  before_counts jsonb; after_counts jsonb := '{}';
begin
  create temp table tenant_tables on commit drop as
    select c.oid, c.relname::text as relname, case when c.relname = 'institutes' then 'id' else 'institute_id' end as key
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
      and (c.relname = 'institutes'
           or exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'institute_id'));

  select jsonb_object_agg(relname, 0) into before_counts from tenant_tables;
  for t in select * from tenant_tables order by relname loop
    execute format('select count(*) from public.%I where %I = $1', t.relname, t.key) into n using b;
    before_counts := before_counts || jsonb_build_object(t.relname, n);
    return next ok(n > 0, format('fixture: %s has bravo rows', t.relname));
  end loop;

  for t in select * from tenant_tables order by relname loop
    execute format('select to_jsonb(x) from public.%I x where %I = $1 limit 1', t.relname, t.key) into brow using b;
    if brow ? 'id' and length(brow ->> 'id') = 36 then brow := jsonb_set(brow, '{id}', to_jsonb(gen_random_uuid())); end if;

    foreach persona in array personas loop
      api_role := case when persona = 'anon' then 'anon' else 'authenticated' end;
      select string_agg(quote_ident(attname), ', ') into cols from pg_attribute
      where attrelid = t.oid and attnum > 0 and not attisdropped and has_column_privilege(api_role, t.oid, attnum, 'INSERT');
      select quote_ident(attname) into ucol from pg_attribute
      where attrelid = t.oid and attnum > 0 and not attisdropped and has_column_privilege(api_role, t.oid, attnum, 'UPDATE')
      limit 1;

      if persona = 'anon' then perform tests.as_anon(); else perform tests.login(persona); end if;

      begin
        execute format('select count(*) from public.%I where %I = $1', t.relname, t.key) into n using b;
      exception when insufficient_privilege then n := 0;
      end;
      return next is(n, 0::bigint, format('%s × %s × select', t.relname, persona));

      begin
        if cols is null then raise sqlstate '42501'; end if;
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                       t.relname, cols, cols, t.relname) using brow;
        outcome := 'ALLOWED';
      exception when insufficient_privilege then outcome := 'denied';
                when others then outcome := 'error ' || sqlstate;
      end;
      return next is(outcome, 'denied', format('%s × %s × insert', t.relname, persona));

      n := 0;
      begin
        if ucol is not null then
          execute format('update public.%I set %s = %s where %I = $1', t.relname, ucol, ucol, t.key) using b;
          get diagnostics n = row_count;
        end if;
      exception when insufficient_privilege then n := 0;
      end;
      return next is(n, 0::bigint, format('%s × %s × update', t.relname, persona));

      begin
        execute format('delete from public.%I where %I = $1', t.relname, t.key) using b;
        get diagnostics n = row_count;
      exception when insufficient_privilege then n := 0;
      end;
      return next is(n, 0::bigint, format('%s × %s × delete', t.relname, persona));

      perform tests.logout();
    end loop;
  end loop;

  for t in select * from tenant_tables loop
    execute format('select count(*) from public.%I where %I = $1', t.relname, t.key) into n using b;
    after_counts := after_counts || jsonb_build_object(t.relname, n);
  end loop;
  return next is(after_counts, before_counts, 'bravo row counts unchanged after the whole matrix');
end $$;

select * from pg_temp.matrix();

-- RPCs of bravo called by alpha's owner.
select tests.login('owner@alpha.test');
select throws_ok(format($$ select public.create_invitation(%L, 'x@alpha.test', 'student') $$, tests.inst('bravo')),
  '42501', null, 'alpha owner cannot invite into bravo (forged institute id, AC2.5)');
select throws_ok($$ select public.accept_invitation('tok-bravo') $$, 'P0001', 'email_mismatch',
  'alpha owner cannot accept a bravo invitation');
select tests.logout();

select * from finish();
rollback;
