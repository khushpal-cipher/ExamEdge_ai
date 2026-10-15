// LOCAL demo data: "Demo Classes" (demo.localhost) and "Rival Academy" (rival.localhost, exists to prove isolation).
// Run after `npm run db:reset`. All demo users sign in with "Sign in as demo user" (password: DEMO_PASSWORD).
// Later phases extend this file (documents, tests, ranks, practice data).
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { localSupabase } from './local-supabase';

const FIRST = [
  'Aarav',
  'Riya',
  'Vihaan',
  'Ananya',
  'Arjun',
  'Diya',
  'Kabir',
  'Isha',
  'Rohan',
  'Meera',
  'Aditya',
  'Sara',
  'Kunal',
  'Priya',
  'Dev',
  'Neha',
  'Yash',
  'Tanvi',
  'Ishaan',
  'Pooja',
  'Rahul',
  'Sneha',
  'Varun',
  'Kavya',
  'Nikhil',
];
const LAST = ['Sharma', 'Patel', 'Iyer', 'Gupta', 'Reddy', 'Singh', 'Nair', 'Joshi', 'Das', 'Mehta'];
const PLAN = [
  {
    batch: 'JEE 2027 Morning',
    exam: 'JEE_MAIN',
    subjects: ['Physics', 'Chemistry', 'Maths'],
    teachers: [1, 2],
    students: [1, 25],
  },
  {
    batch: 'NEET 2027 Evening',
    exam: 'NEET_UG',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    teachers: [2, 3],
    students: [26, 50],
  },
];
const CHAPTERS: Record<string, string[]> = {
  Physics: ['Units and Measurement', 'Laws of Motion', 'Rotational Motion', 'Gravitation'],
  Chemistry: ['Atomic Structure', 'Chemical Bonding', 'Thermodynamics', 'Equilibrium'],
  Maths: ['Sets and Functions', 'Quadratic Equations', 'Limits and Derivatives', 'Probability'],
  Biology: ['Cell: The Unit of Life', 'Plant Physiology', 'Human Physiology', 'Genetics'],
};

const { admin, db } = localSupabase();
const users = new Map<string, string>();

async function user(email: string, fullName: string) {
  if (users.has(email)) return users.get(email)!;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  users.set(email, data.user.id);
  return data.user.id;
}

async function member(inst: string, email: string, fullName: string, role: string) {
  const { rows } = await db.query(
    'insert into public.memberships (institute_id, user_id, role) values ($1, $2, $3) returning id',
    [inst, await user(email, fullName), role],
  );
  return rows[0].id as string;
}

async function seedInstitute(slug: string, name: string) {
  const one = async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows[0].id as string;
  const inst = await one('insert into public.institutes (slug, name) values ($1, $2) returning id', [slug, name]);
  await db.query('insert into public.institute_domains (hostname, institute_id) values ($1, $2)', [
    `${slug}.localhost`,
    inst,
  ]);
  await member(inst, `owner@${slug}.test`, `${name} Owner`, 'owner');
  await member(inst, `admin@${slug}.test`, `${name} Office`, 'admin');
  const teachers = [];
  for (const n of [1, 2, 3])
    teachers[n] = await member(inst, `teacher${n}@${slug}.test`, `Teacher ${LAST[n]} (${slug})`, 'teacher');
  const students = [];
  for (let n = 1; n <= 50; n++) {
    const fullName = `${FIRST[(n * 7 + slug.length) % FIRST.length]} ${LAST[(n * 3 + slug.length) % LAST.length]}`;
    students[n] = await member(inst, `student${String(n).padStart(2, '0')}@${slug}.test`, fullName, 'student');
  }
  const subjects = new Map<string, string>();
  for (const s of Object.keys(CHAPTERS)) {
    const sid = await one('insert into public.subjects (institute_id, name) values ($1, $2) returning id', [inst, s]);
    subjects.set(s, sid);
    for (const [i, c] of CHAPTERS[s]!.entries()) {
      await db.query('insert into public.chapters (institute_id, subject_id, name, position) values ($1, $2, $3, $4)', [
        inst,
        sid,
        c,
        i + 1,
      ]);
    }
  }
  for (const p of PLAN) {
    const bid = await one(
      `insert into public.batches (institute_id, name, academic_year, exam_id)
       values ($1, $2, '2026-27', (select id from public.exams where code = $3)) returning id`,
      [inst, p.batch, p.exam],
    );
    for (const s of p.subjects) {
      await db.query('insert into public.batch_subjects values ($1, $2, $3)', [bid, subjects.get(s), inst]);
    }
    for (const t of p.teachers)
      await db.query(`insert into public.batch_members values ($1, $2, $3, 'teacher')`, [bid, teachers[t], inst]);
    for (let n = p.students[0]!; n <= p.students[1]!; n++) {
      await db.query(`insert into public.batch_members values ($1, $2, $3, 'student')`, [bid, students[n], inst]);
    }
  }
  return inst;
}

await db.connect();
try {
  const { rowCount } = await db.query(`select 1 from public.institutes where slug in ('demo', 'rival')`);
  if (rowCount) throw new Error('demo data already present: run `npm run db:reset` first');
  await db.query('begin');
  await seedInstitute('demo', 'Demo Classes');
  const rival = await seedInstitute('rival', 'Rival Academy');
  // One teacher who works at both institutes (TEST_STRATEGY §2).
  await member(rival, 'teacher1@demo.test', 'Teacher Patel (demo)', 'teacher');
  await db.query(`insert into private.platform_admins (user_id, granted_by) values ($1, 'seed-demo')`, [
    await user('platform@examedge.test', 'Platform Admin'),
  ]);
  await db.query('commit');
  console.log(
    `Seeded demo + rival (${users.size} users). Sign in at http://demo.localhost:3000 as e.g. owner@demo.test`,
  );
} catch (e) {
  await db.query('rollback').catch(() => {});
  throw e;
} finally {
  await db.end();
}
