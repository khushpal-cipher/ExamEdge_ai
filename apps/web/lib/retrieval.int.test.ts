// AC6.4 / T-ISO-06: 0 cross-tenant passages in 1,000 retrieval queries. Two fresh institutes (tests.make_institute)
// get the same Physics notes; B's notes also carry a canary phrase. A's student calls rpc match_chunks with their own
// token through PostgREST (the path the tutor route uses) with A's subjects, B's subject id and B's canary text.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { fakeEmbedding, toVector } from '@examedge/core/ai/embed';
import { localSupabase } from '../../../scripts/local-supabase';

const { env, admin, db } = localSupabase();
const n = Date.now() % 1e9;
const [a, b] = [`reta${n}`, `retb${n}`];
const canary = `quokka saffron lighthouse ${b}`;
const email = `student@${a}.test`;
const password = 'retrieval-test-local-only';
const NOTES = [
  'Torque is the turning effect of a force about an axis, equal to r cross F.',
  'Moment of inertia measures how mass is spread around the axis of rotation.',
  'Angular momentum is conserved when the net external torque is zero.',
  'For rolling without slipping the speed of the centre equals omega times radius.',
  'Kinetic energy of rotation is half I omega squared.',
  'Parallel axis theorem: I equals I centre plus M d squared.',
  'घूर्णन गति में बल आघूर्ण बल का घुमाने वाला प्रभाव है।',
  'Torque kya hota hai? Torque force ka turning effect hai.',
];
const subjects: Record<string, { physics: string; chemistry: string }> = {};

async function addNotes(slug: string, extra: string) {
  const { rows } = await db.query(
    `select c.document_id, c.document_version_id, c.subject_id from public.document_chunks c
     join public.institutes i on i.id = c.institute_id where i.slug = $1`,
    [slug],
  );
  const { document_id, document_version_id, subject_id } = rows[0];
  for (const [i, note] of NOTES.entries()) {
    const content = `${note} ${extra}`.trim();
    await db.query(
      `insert into public.document_chunks (institute_id, document_id, document_version_id, subject_id, chunk_index,
         page_start, page_end, content, embedding, token_count)
       values (tests.inst($1), $2, $3, $4, $5, $5, $5, $6, $7, 20)`,
      [slug, document_id, document_version_id, subject_id, i + 1, content, toVector(fakeEmbedding(content))],
    );
  }
  const { rows: s } = await db.query(
    `select s.name, s.id from public.subjects s where s.institute_id = tests.inst($1)`,
    [slug],
  );
  subjects[slug] = {
    physics: s.find((r) => r.name === 'Physics').id,
    chemistry: s.find((r) => r.name === 'Chemistry').id,
  };
}

beforeAll(async () => {
  await db.connect();
  for (const slug of [a, b]) await db.query('select tests.make_institute($1)', [slug]);
  await addNotes(a, '');
  await addNotes(b, canary);
  // Users made in SQL cannot sign in through GoTrue, so A's student is created through the auth API.
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await db.query(
    `with m as (insert into public.memberships (institute_id, user_id, role) values (tests.inst($1), $2, 'student')
       returning id, institute_id)
     insert into public.batch_members select b.id, m.id, m.institute_id, 'student'
     from m join public.batches b on b.institute_id = m.institute_id and b.name = 'Batch X'`,
    [a, data.user.id],
  );
});

afterAll(async () => {
  await db.query('delete from public.institutes where slug in ($1, $2)', [a, b]);
  await db.query(`delete from auth.users where email like $1 or email like $2`, [`%@${a}.test`, `%@${b}.test`]);
  await db.end();
});

it("AC6.4: 1,000 queries by institute A's student return 0 passages from institute B", async () => {
  const student = createClient(env.API_URL!, env.PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await student.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const [inst] = (await db.query('select tests.inst($1) as id', [a])).rows.map((r) => r.id as string);

  const questions = [...NOTES, canary, `${canary} torque`, `Torque notes canary ${b}zebra`, 'What is torque?'];
  const scopes = [subjects[a]!.physics, subjects[a]!.physics, subjects[a]!.chemistry, subjects[b]!.physics];
  const queries = Array.from({ length: 1000 }, (_, i) => ({
    q: questions[i % questions.length]!,
    subject: scopes[Math.floor(i / questions.length) % scopes.length]!,
  }));

  let rows = 0;
  let answered = 0;
  for (let i = 0; i < queries.length; i += 25) {
    const results = await Promise.all(
      queries
        .slice(i, i + 25)
        .map(({ q, subject }) =>
          student.rpc('match_chunks', { query_embedding: toVector(fakeEmbedding(q)), query_text: q, subject, k: 30 }),
        ),
    );
    for (const [j, { data, error }] of results.entries()) {
      expect(error).toBeNull();
      const found = data as { institute_id: string; content: string }[];
      const { subject } = queries[i + j]!;
      // Only A's Physics notes are published to the student's batch; A's Chemistry and every B subject return nothing.
      if (subject !== subjects[a]!.physics) expect(found).toEqual([]);
      for (const row of found) {
        expect(row.institute_id).toBe(inst);
        expect(row.content).not.toContain(b);
        expect(row.content).not.toContain('quokka');
      }
      rows += found.length;
      if (found.length) answered++;
    }
  }
  // Guard against a vacuous pass: A's own Physics queries do return A's notes.
  expect(answered).toBe(queries.filter((x) => x.subject === subjects[a]!.physics).length);
  expect(rows).toBeGreaterThan(answered);
});
