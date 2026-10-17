// Phase 9 journeys: a teacher generates study material, the same request is reused without AI use (AC9.2), publishes
// it and a student sees it; a student makes a private practice quiz that the database grades, and nobody else — a
// classmate, staff, another institute — can open it (AC9.4). Needs `npm run seed:demo` (seeded Studio summary).
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, demoTopic, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';

async function login(page: Page, email: string, base = DEMO) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

const topic = async (name: string) => (await demoTopic('Physics', name)).topic;

// The topic page's Smart Study tab (ADR-038).
async function smartStudy(page: Page, chapter: string) {
  await page.goto(`${DEMO}/topics/${await topic(chapter)}`);
  await page.getByRole('tab', { name: 'Smart Study' }).click();
  return page.getByRole('tabpanel', { name: 'Smart Study' });
}

const generations = async () =>
  (
    await sql(
      `select count(*)::int as n from usage_records u join institutes i on i.id = u.institute_id
       where i.slug = 'demo' and u.feature = 'generation'`,
    )
  ).rows[0].n as number;

async function generate(page: Page, chapter: string, kind: string) {
  const form = (await smartStudy(page, chapter)).getByRole('form', { name: 'Make study material' });
  await form.getByLabel('Make').selectOption({ label: kind });
  await form.getByRole('button', { name: 'Generate' }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?ok=(generated|reused)$/);
  const url = new URL(page.url());
  return { id: url.pathname.split('/').pop()!, ok: url.searchParams.get('ok') };
}

test('teacher generates, reuses and publishes study material; students of the batch see it', async ({ browser }) => {
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, 'teacher1@demo.test');

  // The seed made this summary from the same notes, so asking again reuses it without any AI use (AC9.2).
  const before = await generations();
  const seeded = await generate(teacher, 'Rotational Motion', 'Summary');
  expect(seeded.ok).toBe('reused');
  await expect(teacher.getByRole('status')).toContainText('no AI use counted');
  expect(await generations()).toBe(before);

  const made = await generate(teacher, 'Laws of Motion', 'Mind map');
  try {
    expect(made.ok).toBe('generated');
    expect(await generations()).toBe(before + 1);
    await expect(teacher.getByText('Draft — students cannot see it')).toBeVisible();
    // Every section cites the notes it came from (AC9.3).
    await expect(
      teacher.getByRole('link', { name: /From your institute's notes: Laws of Motion/ }).first(),
    ).toBeVisible();
    const again = await generate(teacher, 'Laws of Motion', 'Mind map');
    expect(again).toEqual({ id: made.id, ok: 'reused' });
    expect(await generations()).toBe(before + 1);

    // A draft is invisible to students.
    const student = await (await browser.newContext()).newPage();
    await login(student, 'student04@demo.test');
    expect((await student.goto(`${DEMO}/studio/${made.id}`))?.status()).toBe(404);

    await teacher.getByLabel('JEE 2027 Morning').check();
    await teacher.getByRole('button', { name: 'Approve and publish' }).click();
    await expect(teacher.getByRole('status')).toContainText('Published.');

    await (
      await smartStudy(student, 'Laws of Motion')
    )
      .getByRole('list', { name: 'From your teachers' })
      .getByRole('link', { name: 'Mind map: Laws of Motion' })
      .click();
    await expect(student.getByRole('heading', { level: 1 })).toHaveText('Mind map: Laws of Motion');
    await expect(student.getByText('Checked and shared by your teachers.')).toBeVisible();
  } finally {
    await sql('delete from generated_artifacts where id = $1', [made.id]);
  }
});

test('a student practice quiz is graded by the database and private to its owner', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, 'student02@demo.test');
  const quiz = await generate(page, 'Laws of Motion', 'Practice quiz');
  try {
    await expect(page.getByText('Only you can see it.')).toBeVisible();
    const { rows } = await sql('select content from generated_artifacts where id = $1', [quiz.id]);
    const questions = rows[0].content.questions as { id: string; answer: string }[];
    // Answer only the first question, correctly.
    await page.locator(`input[name="${questions[0]!.id}"][value="${questions[0]!.answer}"]`).check();
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Your score: 1 of ${questions.length}.` })).toBeVisible();
    const tries = await sql('select score, max_score from practice_attempts where artifact_id = $1', [quiz.id]);
    expect(tries.rows).toEqual([{ score: 1, max_score: questions.length }]);
    await page.goto(`${DEMO}/progress`);
    await expect(page.getByText(/Physics · Laws of Motion: 1 practice quiz/)).toBeVisible();

    // AC9.4: a classmate, staff and another institute get nothing, in the UI and through the API.
    for (const [email, base] of [
      ['student03@demo.test', DEMO],
      ['teacher1@demo.test', DEMO],
      ['owner@demo.test', DEMO],
      ['owner@rival.test', RIVAL],
    ] as const) {
      const other = await (await browser.newContext()).newPage();
      await login(other, email, base);
      expect((await other.goto(`${base}/studio/${quiz.id}`))?.status(), email).toBe(404);
      const db = await signedIn(email);
      const art = await db.from('generated_artifacts').select('id').eq('id', quiz.id);
      const att = await db.from('practice_attempts').select('id').eq('artifact_id', quiz.id);
      expect([art.data, att.data], email).toEqual([[], []]);
      const sub = await db.rpc('submit_practice', { art: quiz.id, answers: {} });
      expect(sub.error?.code, email).toBe('42501');
      await other.context().close();
    }
    // Staff never list students' own material.
    const staff = await (await browser.newContext()).newPage();
    await login(staff, 'teacher1@demo.test');
    await expect(
      (await smartStudy(staff, 'Laws of Motion')).getByRole('link', { name: 'Practice quiz: Laws of Motion' }),
    ).toHaveCount(0);
  } finally {
    await sql('delete from generated_artifacts where id = $1', [quiz.id]);
  }
});
