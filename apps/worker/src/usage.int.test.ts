// AC5.3: quotas hold under concurrency, through the same paths production uses — a student's own token against
// PostgREST (rpc ai_reserve) and the worker role in a job's tenant context (ai_reserve_job).
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { localSupabase, localWorkerEnv } from '../../../scripts/local-supabase';
import { workerMeter } from './ingest';

const { env, admin, db } = localSupabase();
const slug = `use${Date.now() % 1e9}`;
const email = `student@${slug}.test`;
const password = 'usage-test-local-only';
let inst: string;
let pool: pg.Pool;

beforeAll(async () => {
  await db.connect();
  inst = (await db.query('select tests.make_institute($1) as id', [slug])).rows[0].id;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await db.query(`insert into public.memberships (institute_id, user_id, role) values ($1, $2, 'student')`, [
    inst,
    data.user.id,
  ]);
  pool = new pg.Pool({ connectionString: localWorkerEnv(env).WORKER_DATABASE_URL, max: 10 });
});

afterAll(async () => {
  await db.query('delete from public.institutes where slug = $1', [slug]);
  await db.query('delete from auth.users where email = $1', [email]);
  await pool?.end();
  await db.end();
});

it('100 parallel tutor reservations by one student with a limit of 40 → exactly 40 go through', async () => {
  await db.query('update public.institute_quotas set student_daily_messages = 40 where institute_id = $1', [inst]);
  const student = createClient(env.API_URL!, env.PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await student.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const results = await Promise.all(
    Array.from({ length: 100 }, () =>
      student.rpc('ai_reserve', { inst, feat: 'tutor', prov: 'fake', mdl: 'fake', reserve: 1 }).single(),
    ),
  );
  expect(results.filter((r) => r.error)).toEqual([]);
  const blocked = results.map((r) => (r.data as { blocked: string | null }).blocked);
  expect(blocked.filter((b) => b === null)).toHaveLength(40);
  expect(blocked.filter((b) => b === 'quota')).toHaveLength(60);
  const { rows } = await db.query(
    `select c.value from public.usage_counters c join auth.users u on u.id = c.user_id
     where c.institute_id = $1 and c.counter_key = 'messages' and u.email = $2`,
    [inst, email],
  );
  expect(rows).toEqual([{ value: 40 }]);
});

it('100 parallel worker reservations never reserve more than the institute budget', async () => {
  await db.query(
    `update public.institute_quotas set monthly_ai_budget_micro_usd = 1000 + coalesce((select
       sum(case when outcome = 'pending' then reserved_micro_usd else cost_micro_usd end)
       from public.usage_records where institute_id = $1), 0) where institute_id = $1`,
    [inst],
  );
  const meter = workerMeter(pool, inst, crypto.randomUUID());
  const results = await Promise.all(Array.from({ length: 100 }, () => meter.reserve('ingest_ocr', 'fake', 'fake', 30)));
  expect(results.filter((r) => r.blocked === null)).toHaveLength(33); // floor(1000 / 30)
  expect(results.filter((r) => r.blocked === 'budget')).toHaveLength(67);
  const { rows } = await db.query(
    `select sum(reserved_micro_usd)::int as reserved from public.usage_records
     where institute_id = $1 and feature = 'ingest_ocr'`,
    [inst],
  );
  expect(rows[0].reserved).toBe(990);
});
