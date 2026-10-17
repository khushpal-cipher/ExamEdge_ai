// LOCAL demo data: "Demo Classes" (demo.localhost) and "Rival Academy" (rival.localhost, exists to prove isolation).
// Run after `npm run db:reset`. All demo users sign in with "Sign in as demo user" (password: DEMO_PASSWORD).
// Later phases extend this file (documents, practice data).
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { drain } from '../apps/worker/src/ingest';
import { fakeContent, SCHEMA_VERSION, STUDIO_PROMPT_VERSION, validateArtifact } from '../packages/core/src/ai/studio';
import { workerDownloader } from '../apps/worker/src/storage';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { NOTES } from './demo-notes';
import { ensureWorkerAccount, localSupabase, localWorkerEnv } from './local-supabase';
import { makePdf } from './make-pdf';

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

const { env, admin, db } = localSupabase();
const files: { path: string; pdf: Buffer }[] = [];
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
  // Each batch has its own subjects (ADR-038). The demo content (notes, questions, Studio) lives in the first batch
  // that studies a subject, like the R1.1 migration did; later batches get the same topics, empty.
  const subjects = new Map<string, string>();
  const chapters = new Map<string, string>();
  const subtopics = new Map<string, string>(); // topic id → its "Class notes" subtopic
  const batches: { id: string; students: number[] }[] = [];
  for (const p of PLAN) {
    const bid = await one(
      `insert into public.batches (institute_id, name, academic_year, exam_id)
       values ($1, $2, '2026-27', (select id from public.exams where code = $3)) returning id`,
      [inst, p.batch, p.exam],
    );
    for (const s of p.subjects) {
      const sid = await one(
        'insert into public.subjects (institute_id, batch_id, name) values ($1, $2, $3) returning id',
        [inst, bid, s],
      );
      const first = !subjects.has(s);
      if (first) subjects.set(s, sid);
      for (const [i, c] of CHAPTERS[s]!.entries()) {
        const cid = await one(
          'insert into public.chapters (institute_id, subject_id, name, position) values ($1, $2, $3, $4) returning id',
          [inst, sid, c, i + 1],
        );
        const stid = await one(
          `insert into public.subtopics (institute_id, subject_id, chapter_id, name) values ($1, $2, $3, 'Class notes')
           returning id`,
          [inst, sid, cid],
        );
        if (first) {
          chapters.set(c, cid);
          subtopics.set(cid, stid);
        }
      }
    }
    for (const t of p.teachers)
      await db.query(`insert into public.batch_members values ($1, $2, $3, 'teacher')`, [bid, teachers[t], inst]);
    for (let n = p.students[0]!; n <= p.students[1]!; n++) {
      await db.query(`insert into public.batch_members values ($1, $2, $3, 'student')`, [bid, students[n], inst]);
    }
    batches.push({
      id: bid,
      students: Array.from({ length: p.students[1]! - p.students[0]! + 1 }, (_, i) => p.students[0]! + i),
    });
  }
  // Students joined two months ago, so every seeded test counts towards overall rank.
  await db.query(`update public.batch_members set created_at = now() - interval '60 days' where institute_id = $1`, [
    inst,
  ]);
  await seedTests(inst, slug, subjects, chapters, batches, students);
  await seedDocuments(inst, slug, subjects, chapters, subtopics);
  return inst;
}

// Notes for every subject, queued for the worker; the files are uploaded and processed after the commit. Each
// document's audience = its subject's batch. Rival's notes carry a canary phrase (leak detection).
async function seedDocuments(
  inst: string,
  slug: string,
  subjects: Map<string, string>,
  chapters: Map<string, string>,
  subtopics: Map<string, string>,
) {
  for (const n of NOTES) {
    const pages =
      slug === 'rival'
        ? [...n.pages, ['Rival canary: quokka saffron lighthouse. This sentence exists only in Rival Academy notes.']]
        : n.pages;
    const { rows } = await db.query(
      `insert into public.documents (institute_id, subject_id, chapter_id, subtopic_id, title)
       values ($1, $2, $3, $4, $5) returning id`,
      [inst, subjects.get(n.subject), chapters.get(n.chapter), subtopics.get(chapters.get(n.chapter)!), n.title],
    );
    const doc = rows[0].id as string;
    const version = randomUUID();
    const path = `${inst}/${doc}/${version}`;
    const pdf = makePdf(pages);
    await db.query(
      `insert into public.document_versions (id, institute_id, document_id, version, storage_path, mime, size_bytes,
         processing_status) values ($1, $2, $3, 1, $4, 'application/pdf', $5, 'queued')`,
      [version, inst, doc, path, pdf.length],
    );
    if (!n.draft)
      await db.query(
        `insert into public.document_audience (document_id, batch_id, institute_id)
         select $1, batch_id, $2 from public.subjects where id = $3`,
        [doc, inst, subjects.get(n.subject)],
      );
    files.push({ path, pdf });
  }
}

// Upload the queued files, run the real ingestion once (as the worker role and service account), then publish.
async function processDocuments() {
  await ensureWorkerAccount(admin, db);
  for (const f of files) {
    const { error } = await admin.storage.from('documents').upload(f.path, f.pdf, { contentType: 'application/pdf' });
    if (error) throw new Error(`upload ${f.path}: ${error.message}`);
  }
  const workerEnv = localWorkerEnv(env);
  const pool = new pg.Pool({ connectionString: workerEnv.WORKER_DATABASE_URL, max: 2 });
  try {
    await drain({ pool, download: await workerDownloader(workerEnv) });
  } finally {
    await pool.end();
  }
  const { rowCount } = await db.query(
    `update public.documents d set status = 'published'
     where current_version_id is not null and exists (select 1 from public.document_audience a where a.document_id = d.id)`,
  );
  console.log(`Processed ${files.length} documents, published ${rowCount}.`);
}

// ---------------------------------------------------------------- tests, answers and ranks (Phase 7)
type Q = {
  subject: string;
  chapter: string;
  type: string;
  stem: string;
  options?: string[];
  key: unknown;
  explanation?: string;
};
const QUESTIONS: Q[] = [
  {
    subject: 'Physics',
    chapter: 'Units and Measurement',
    type: 'single',
    stem: 'The SI unit of force is',
    options: ['Newton', 'Joule', 'Watt', 'Pascal'],
    key: { correct: ['a'] },
    explanation: '1 N = 1 kg·m/s².',
  },
  {
    subject: 'Physics',
    chapter: 'Laws of Motion',
    type: 'single',
    stem: 'A body at rest stays at rest unless acted on by a net force. This is',
    options: ["Newton's first law", "Newton's second law", "Newton's third law", "Hooke's law"],
    key: { correct: ['a'] },
  },
  {
    subject: 'Physics',
    chapter: 'Laws of Motion',
    type: 'numerical',
    stem: 'A 2 kg block accelerates at 3 m/s². What is the net force on it in newtons?',
    key: { value: 6, tolerance_abs: 0.01 },
    explanation: 'F = ma = 2 × 3 = 6 N.',
  },
  {
    subject: 'Physics',
    chapter: 'Rotational Motion',
    type: 'multi',
    stem: 'Which of these are vector quantities?',
    options: ['Torque', 'Angular momentum', 'Moment of inertia', 'Kinetic energy'],
    key: { correct: ['a', 'b'] },
  },
  {
    subject: 'Physics',
    chapter: 'Rotational Motion',
    type: 'written',
    stem: 'Explain why a figure skater spins faster when she pulls her arms in.',
    key: {
      model_answer:
        'Angular momentum L = Iω is conserved (no external torque). Pulling the arms in lowers the moment of inertia I, so ω increases.',
    },
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation',
    type: 'numerical',
    stem: 'Take g = 9.8 m/s². How long (in s) does a ball dropped from 19.6 m take to reach the ground?',
    key: { value: 2, tolerance_abs: 0.05 },
    explanation: 'h = ½gt² → t = √(2h/g) = 2 s.',
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation',
    type: 'single',
    stem: 'Escape velocity from the Earth is about',
    options: ['11.2 km/s', '7.9 km/s', '3 km/s', '30 km/s'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Chemistry',
    chapter: 'Atomic Structure',
    type: 'single',
    stem: 'The number of electrons in a neutral carbon atom is',
    options: ['6', '12', '4', '8'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Bonding',
    type: 'multi',
    stem: 'Which molecules have a linear shape?',
    options: ['CO₂', 'H₂O', 'BeCl₂', 'NH₃'],
    key: { correct: ['a', 'c'] },
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Bonding',
    type: 'written',
    stem: 'Why is water a polar molecule even though each O–H bond is identical?',
    key: {
      model_answer:
        'The O–H bonds are polar and the molecule is bent (about 104.5°), so the bond dipoles do not cancel and there is a net dipole moment.',
    },
  },
  {
    subject: 'Chemistry',
    chapter: 'Thermodynamics',
    type: 'single',
    stem: 'For a spontaneous process at constant T and P',
    options: ['ΔG < 0', 'ΔG > 0', 'ΔH > 0 always', 'ΔS < 0 always'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Chemistry',
    chapter: 'Equilibrium',
    type: 'numerical',
    stem: 'What is the pH of a 0.001 M HCl solution?',
    key: { value: 3, tolerance_abs: 0.01 },
  },
  {
    subject: 'Maths',
    chapter: 'Quadratic Equations',
    type: 'numerical',
    stem: 'What is the sum of the roots of x² − 5x + 6 = 0?',
    key: { value: 5, tolerance_abs: 0 },
  },
  {
    subject: 'Maths',
    chapter: 'Limits and Derivatives',
    type: 'single',
    stem: 'd/dx (x³) =',
    options: ['3x²', 'x²', '3x', 'x³/3'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Maths',
    chapter: 'Probability',
    type: 'single',
    stem: 'Two fair coins are tossed. The probability of exactly one head is',
    options: ['1/2', '1/4', '3/4', '1/3'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Biology',
    chapter: 'Cell: The Unit of Life',
    type: 'single',
    stem: 'The powerhouse of the cell is the',
    options: ['Mitochondrion', 'Ribosome', 'Golgi body', 'Nucleus'],
    key: { correct: ['a'] },
  },
  {
    subject: 'Biology',
    chapter: 'Genetics',
    type: 'written',
    stem: "State Mendel's law of segregation.",
    key: {
      model_answer:
        'The two alleles of a gene separate during gamete formation, so each gamete receives only one allele.',
    },
  },
  {
    subject: 'Biology',
    chapter: 'Human Physiology',
    type: 'multi',
    stem: 'Which of these are parts of the human digestive system?',
    options: ['Liver', 'Pancreas', 'Kidney', 'Lungs'],
    key: { correct: ['a', 'b'] },
  },
];

// Deterministic per-student "ability" and choices, so every reseed gives the same ranks.
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

async function seedTests(
  inst: string,
  slug: string,
  subjects: Map<string, string>,
  chapters: Map<string, string>,
  batches: { id: string; students: number[] }[],
  students: string[],
) {
  const one = async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows[0].id as string;
  const teacher = users.get(`teacher1@${slug}.test`)!;
  const qid = new Map<string, string>();
  for (const q of QUESTIONS) {
    const options = (q.options ?? []).map((text, i) => ({ id: 'abcd'[i], text }));
    const id = await one(
      `insert into public.questions (institute_id, subject_id, chapter_id, type, stem, options, explanation, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [
        inst,
        subjects.get(q.subject),
        chapters.get(q.chapter),
        q.type,
        q.stem,
        JSON.stringify(options),
        q.explanation ?? '',
        teacher,
      ],
    );
    await db.query('insert into public.question_keys values ($1, $2, $3)', [id, inst, JSON.stringify(q.key)]);
    qid.set(q.stem, id);
  }
  const bySubject = (...names: string[]) => QUESTIONS.filter((q) => names.includes(q.subject));
  const [jee, neet] = batches as [{ id: string; students: number[] }, { id: string; students: number[] }];
  // closes = days from now (negative = past); state: released | checking | scheduled.
  const plan: { title: string; batch: typeof jee; qs: Q[]; closes: number; opens: number; state: string }[] = [
    {
      title: 'Physics Test 1',
      batch: jee,
      qs: bySubject('Physics').filter((q) => q.type !== 'written'),
      opens: -21.1,
      closes: -21,
      state: 'released',
    },
    {
      title: 'Mixed Test 2',
      batch: jee,
      qs: bySubject('Physics', 'Chemistry', 'Maths').slice(2, 14),
      opens: -7.1,
      closes: -7,
      state: 'released',
    },
    { title: 'Chemistry Test 3', batch: jee, qs: bySubject('Chemistry'), opens: -1.1, closes: -1, state: 'checking' },
    {
      title: 'Physics Practice Test',
      batch: jee,
      qs: bySubject('Physics').slice(0, 5),
      opens: -0.1,
      closes: 3,
      state: 'scheduled',
    },
    { title: 'Maths Test 4', batch: jee, qs: bySubject('Maths'), opens: 2, closes: 2.1, state: 'scheduled' },
    {
      title: 'NEET Biology Test 1',
      batch: neet,
      qs: bySubject('Biology', 'Chemistry').slice(0, 8),
      opens: -5.1,
      closes: -5,
      state: 'released',
    },
    {
      title: 'NEET Physics Test 2',
      batch: neet,
      qs: bySubject('Physics').slice(0, 4),
      opens: 3,
      closes: 3.1,
      state: 'scheduled',
    },
  ];
  for (const [ti, t] of plan.entries()) {
    const test = await one(
      `insert into public.tests (institute_id, title, opens_at, closes_at, duration_seconds, status, created_by)
       values ($1, $2, now() + make_interval(secs => $3::float8 * 86400), now() + make_interval(secs => $4::float8 * 86400), 3600,
               'scheduled', $5) returning id`,
      [inst, t.title, t.opens, t.closes, teacher],
    );
    await db.query('insert into public.test_audience values ($1, $2, $3)', [test, t.batch.id, inst]);
    for (const [i, q] of t.qs.entries()) {
      await db.query(
        'insert into public.test_questions (test_id, question_id, institute_id, position, marks, negative_marks) values ($1, $2, $3, $4, $5, $6)',
        [test, qid.get(q.stem), inst, i + 1, q.type === 'written' ? 5 : 4, q.type === 'single' ? 1 : 0],
      );
    }
    if (t.state === 'scheduled') continue;
    for (const n of t.batch.students) {
      if (n > 1 && rand(n * 31 + ti) < 0.08) continue; // missed the test (student01, the demo login, never misses)
      const ability = 0.35 + 0.6 * rand(n);
      const minutes = 20 + Math.floor(35 * rand(n * 7 + ti));
      const attempt = await one(
        `insert into public.test_attempts (institute_id, test_id, user_id, membership_id, started_at, deadline_at,
                                           submitted_at, status, question_order)
         select $1, $2, m.user_id, m.id, t.opens_at + interval '5 minutes', t.opens_at + interval '65 minutes',
                t.opens_at + interval '5 minutes' + make_interval(mins => $4), 'submitted',
                (select array_agg(question_id order by position) from public.test_questions where test_id = $2)
         from public.memberships m, public.tests t where m.id = $3 and t.id = $2 returning id`,
        [inst, test, students[n], minutes],
      );
      for (const [qi, q] of t.qs.entries()) {
        const r = rand(n * 101 + ti * 13 + qi);
        if (r > 0.92) continue; // left blank
        const right = r < ability;
        const key = q.key as { correct?: string[]; value?: number };
        const response =
          q.type === 'written'
            ? right
              ? (q.key as { model_answer: string }).model_answer
              : 'I am not sure, I think it depends on the temperature.'
            : q.type === 'numerical'
              ? right
                ? key.value!
                : key.value! + 1
              : right
                ? key.correct!
                : q.type === 'single'
                  ? [key.correct![0] === 'a' ? 'b' : 'a']
                  : [key.correct![0]];
        const marked = q.type === 'written' && t.state === 'released';
        await db.query(
          `insert into public.attempt_answers (attempt_id, question_id, institute_id, response, marks_awarded, graded_by,
                                               graded_at, teacher_comment) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            attempt,
            qid.get(q.stem),
            inst,
            JSON.stringify(response),
            marked ? (right ? 4.5 : 1.5) : null,
            marked ? teacher : null,
            marked ? new Date() : null,
            marked && !right ? 'Explain the reason, not just the cause.' : null,
          ],
        );
      }
    }
    if (t.state === 'released') {
      await db.query(
        `update public.tests set status = 'results_released', results_release_at = closes_at where id = $1`,
        [test],
      );
      await db.query('select private.compute_results($1)', [test]);
    }
  }
}

// ---------------------------------------------------------------- Studio (Phase 9)
// Per institute: a published Physics summary of Rotational Motion (made from the processed notes the same way the
// web does, so a teacher's "Generate summary" there is reused) and student01's own practice quiz with one try.
async function seedStudio() {
  for (const slug of ['demo', 'rival']) {
    const { rows: chunks } = await db.query(
      `select c.id, c.document_id, d.title, c.page_start, c.page_end, c.content, d.institute_id, d.subject_id,
              d.chapter_id, ch.name as chapter
       from public.document_chunks c join public.documents d on d.id = c.document_id
       join public.chapters ch on ch.id = d.chapter_id join public.institutes i on i.id = d.institute_id
       where i.slug = $1 and ch.name = 'Rotational Motion' and d.status = 'published' and d.deleted_at is null
       order by d.title, c.chunk_index`,
      [slug],
    );
    const [c0] = chunks;
    const sources = chunks.map(({ document_id, title, page_start, page_end, content }) => ({
      document_id,
      title,
      page_start,
      page_end,
      content,
    }));
    const refs = sources.map(({ content: _, ...ref }) => ref);
    const student = users.get(`student01@${slug}.test`)!;
    const teacher = users.get(`teacher1@${slug}.test`)!;
    const save = async (kind: 'summary' | 'quiz', scope: string) => {
      const hash = createHash('sha256')
        .update(JSON.stringify([kind, c0.chapter_id, chunks.map((c) => String(c.id)).sort()]))
        .digest('hex');
      const content = validateArtifact(kind, fakeContent(kind, c0.chapter, sources), sources.length);
      const published = scope === 'institute';
      const { rows } = await db.query(
        `insert into public.generated_artifacts (institute_id, owner_scope, owner_user_id, kind, subject_id, chapter_id,
           source_refs, input_hash, prompt_version, model, schema_version, content, status, created_by, approved_by,
           approved_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'fake-studio-1', $10, $11, $12, $13, $14, $15) returning id`,
        [
          c0.institute_id,
          scope,
          published ? null : student,
          kind,
          c0.subject_id,
          c0.chapter_id,
          JSON.stringify(refs),
          hash,
          STUDIO_PROMPT_VERSION,
          SCHEMA_VERSION,
          JSON.stringify(content),
          published ? 'published' : 'draft',
          published ? teacher : student,
          published ? teacher : null,
          published ? new Date() : null,
        ],
      );
      return { id: rows[0].id as string, content };
    };
    const summary = await save('summary', 'institute');
    await db.query(
      `insert into public.artifact_audience (artifact_id, batch_id, institute_id)
       select $1, batch_id, institute_id from public.subjects where id = $2`,
      [summary.id, c0.subject_id],
    );
    const quiz = await save('quiz', 'student');
    // One try: the first half answered correctly.
    const qs = (quiz.content as { questions: { id: string; answer: string }[] }).questions;
    const answers = Object.fromEntries(qs.slice(0, Math.ceil(qs.length / 2)).map((q) => [q.id, q.answer]));
    await db.query(
      `insert into public.practice_attempts (institute_id, user_id, artifact_id, answers, score, max_score)
       values ($1, $2, $3, $4, $5, $6)`,
      [c0.institute_id, student, quiz.id, JSON.stringify(answers), Object.keys(answers).length, qs.length],
    );
  }
  console.log('Studio: a published summary and a practice try per institute.');
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
  await processDocuments();
  await seedStudio();
  console.log(
    `Seeded demo + rival (${users.size} users). Sign in at http://demo.localhost:3000 as e.g. owner@demo.test`,
  );
} catch (e) {
  await db.query('rollback').catch(() => {});
  throw e;
} finally {
  await db.end();
}
