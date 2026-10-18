// Phase 9 journeys (R1.1: Studio is for students only, ADR-039): teachers have no Smart Study; students see the
// seeded teacher summary, and the same request is reused without AI use (AC9.2); a student makes a private practice
// quiz that the database grades, and nobody else — a classmate, staff, another institute — can open it (AC9.4).
// Needs `npm run seed:demo` (seeded Studio summary).
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
  await form.getByRole('button', { name: kind, exact: true }).click(); // one tile per tool (ADR-043)
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?ok=(generated|reused)$/);
  const url = new URL(page.url());
  return { id: url.pathname.split('/').pop()!, ok: url.searchParams.get('ok') };
}

test('teachers have no Smart Study; students see teacher material and reuse their own (AC9.2)', async ({ browser }) => {
  // Teachers' AI is AI notes + AI test only (ADR-039): no Smart Study tab, and the database refuses student AI to staff.
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, 'teacher1@demo.test');
  await teacher.goto(`${DEMO}/topics/${await topic('Rotational Motion')}`);
  await expect(teacher.getByRole('tab', { name: 'AI test' })).toBeVisible();
  await expect(teacher.getByRole('tab', { name: 'Smart Study' })).toHaveCount(0);
  const { id: inst } = (await sql(`select id from institutes where slug = 'demo'`)).rows[0];
  const staffApi = await signedIn('teacher1@demo.test');
  for (const feat of ['generation', 'tutor']) {
    const reserve = await staffApi.rpc('ai_reserve', { inst, feat, prov: 'fake', mdl: 'fake', reserve: 1 });
    expect(reserve.error?.code, feat).toBe('42501');
  }

  // The summary teachers published earlier (seeded) is still shown to students of the batch.
  const student = await (await browser.newContext()).newPage();
  await login(student, 'student04@demo.test');
  await (
    await smartStudy(student, 'Rotational Motion')
  )
    .getByRole('list', { name: 'From your teachers' })
    .getByRole('link', { name: 'Summary: Rotational Motion' })
    .click();
  await expect(student.getByText('Checked and shared by your teachers.')).toBeVisible();

  // AC9.2: asking again with the same notes reuses the student's own result without any AI use.
  const before = await generations();
  const made = await generate(student, 'Laws of Motion', 'Mind map');
  try {
    expect(made.ok).toBe('generated');
    expect(await generations()).toBe(before + 1);
    await expect(student.getByText('Only you can see it.')).toBeVisible();
    // Every section cites the notes it came from (AC9.3).
    await expect(
      student.getByRole('link', { name: /From your institute's notes: Laws of Motion/ }).first(),
    ).toBeVisible();
    const again = await generate(student, 'Laws of Motion', 'Mind map');
    expect(again).toEqual({ id: made.id, ok: 'reused' });
    expect(await generations()).toBe(before + 1);

    // A classmate cannot open it.
    const classmate = await (await browser.newContext()).newPage();
    await login(classmate, 'student05@demo.test');
    expect((await classmate.goto(`${DEMO}/studio/${made.id}`))?.status()).toBe(404);
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
    // Staff never list students' own material (and have no Smart Study tab, ADR-039).
    const staff = await (await browser.newContext()).newPage();
    await login(staff, 'teacher1@demo.test');
    await staff.goto(`${DEMO}/topics/${await topic('Laws of Motion')}`);
    await expect(staff.getByRole('tab', { name: 'Subtopics' })).toBeVisible();
    await expect(staff.getByRole('link', { name: 'Practice quiz: Laws of Motion' })).toHaveCount(0);
  } finally {
    await sql('delete from generated_artifacts where id = $1', [quiz.id]);
  }
});
