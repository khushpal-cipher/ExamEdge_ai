// AC7.5 journey: a teacher makes bank questions with AI; a second AI solves each without the key. Questions whose
// answers match can be approved; a flagged one cannot (in the UI or through the API) until the teacher checks and
// saves it. Students and another institute can neither store questions nor reach them. Needs `npm run seed:demo`.
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';

async function login(page: Page, email: string, base = DEMO) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

const one = async (query: string, params: unknown[] = []) => (await sql(query, params)).rows[0];

test('AI questions are drafts; a flagged one is approved only after a teacher saves it', async ({ browser }) => {
  const { id: subject, inst } = await one(
    `select s.id, i.id as inst from subjects s join institutes i on i.id = s.institute_id
     where i.slug = 'demo' and s.name = 'Physics'`,
  );
  const { start } = await one('select now() as start');
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, 'teacher1@demo.test');
  try {
    await teacher.goto(`${DEMO}/questions?subject=${subject}`);
    const form = teacher.getByRole('form', { name: 'Make questions with AI' });
    await form.getByLabel('Chapter').selectOption({ label: 'Rotational Motion' });
    await form.getByLabel('Type').selectOption({ label: 'MCQ — one correct' });
    await form.getByLabel('How many').fill('10');
    await form.getByRole('button', { name: 'Generate' }).click();
    await expect(teacher).toHaveURL(/ok=questions_made$/);
    await expect(teacher.getByRole('status')).toContainText('AI questions added below as drafts');

    const made = (
      await sql(
        `select id, stem, status, verification from questions where origin = 'ai' and created_at >= $1
         order by stem`,
        [start],
      )
    ).rows as { id: string; stem: string; status: string; verification: string }[];
    expect(made.length).toBeGreaterThan(0);
    expect(made.every((q) => q.status === 'draft')).toBe(true);
    const usage = await one(
      `select count(*)::int as n from usage_records where feature = 'question_gen' and created_at >= $1`,
      [start],
    );
    expect(usage.n).toBe(2); // one write, one blind solve
    const flagged = made.find((q) => q.verification === 'dual_solve_disagree')!;
    const matched = made.find((q) => q.verification === 'dual_solve_agree')!;
    expect([flagged, matched].every(Boolean)).toBe(true);

    const row = (stem: string) => teacher.getByRole('row').filter({ hasText: stem.slice(0, 40) });
    await expect(row(flagged.stem).getByText('answers differ, fix before use')).toBeVisible();
    await expect(row(flagged.stem).getByRole('button', { name: /^Approve/ })).toHaveCount(0);

    // Not through the API either.
    const api = await signedIn('teacher1@demo.test');
    const forced = await api.from('questions').update({ status: 'approved' }).eq('id', flagged.id);
    expect(forced.error?.message).toBe('question_not_verified');

    // A matched one is approved with one click.
    await row(matched.stem)
      .getByRole('button', { name: /^Approve/ })
      .click();
    await expect(teacher.getByRole('status')).toHaveText('Approved. It can now be added to tests.');

    // The flagged one shows both answers; saving it (after checking) approves it as teacher-verified.
    await teacher.goto(`${DEMO}/questions/${flagged.id}`);
    await expect(teacher.getByText(/answered [A-D], but the key says [A-D]/)).toBeVisible();
    await teacher.getByRole('button', { name: 'Save question' }).click();
    await expect(teacher.getByRole('status')).toHaveText('Saved.');
    const after = await sql('select id, status, verification from questions where id = any($1) order by id', [
      [flagged.id, matched.id],
    ]);
    expect(after.rows).toEqual(
      [
        { id: flagged.id, status: 'approved', verification: 'teacher_verified' },
        { id: matched.id, status: 'approved', verification: 'dual_solve_agree' },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );

    // Students cannot store bank questions or spend AI on them; another institute cannot see them.
    const student = await signedIn('student01@demo.test');
    const item = { type: 'written', stem: 'x', verification: 'unverified', key: { model_answer: 'x' } };
    const stored = await student.rpc('add_ai_questions', { inst, subject, chapter: null, items: [item] });
    expect(stored.error?.code).toBe('42501');
    const reserve = await student.rpc('ai_reserve', {
      inst,
      feat: 'question_gen',
      prov: 'fake',
      mdl: 'fake',
      reserve: 1,
    });
    expect(reserve.error?.code).toBe('42501');
    const rival = await (await browser.newContext()).newPage();
    await login(rival, 'owner@rival.test', RIVAL);
    expect((await rival.goto(`${RIVAL}/questions/${flagged.id}`))?.status()).toBe(404);
    const rivalApi = await signedIn('owner@rival.test');
    expect((await rivalApi.from('question_keys').select('second_solve').eq('question_id', flagged.id)).data).toEqual(
      [],
    );
  } finally {
    await sql(`delete from questions where origin = 'ai' and created_at >= $1`, [start]);
  }
});
