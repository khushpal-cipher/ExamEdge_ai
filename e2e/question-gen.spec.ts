// AI test journey (ADR-039, AC7.5): a teacher asks for MCQs + theory questions inside a topic and gets a new draft
// test. A second AI solves each MCQ without the key: questions whose answers match can be approved; a flagged one
// cannot (in the UI or through the API) until the teacher checks and saves it; theory questions are approved only by
// saving them. The test cannot be scheduled before every question is approved. Students and another institute can
// neither make AI tests nor reach them. Needs `npm run seed:demo`.
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, demoTopic, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';

async function login(page: Page, email: string, base = DEMO) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

const one = async (query: string, params: unknown[] = []) => (await sql(query, params)).rows[0];

test('AI test: a draft of MCQs + theory; flagged and theory questions need the teacher before scheduling', async ({
  browser,
}) => {
  const { subject, topic } = await demoTopic('Physics', 'Rotational Motion');
  const { id: inst } = await one(`select id from institutes where slug = 'demo'`);
  const { start } = await one('select now() as start');
  const teacher = await (await browser.newContext()).newPage();
  await login(teacher, 'teacher1@demo.test');
  let testId: string | undefined;
  try {
    await teacher.goto(`${DEMO}/topics/${topic}`);
    await teacher.getByRole('tab', { name: 'AI test' }).click();
    const form = teacher.getByRole('form', { name: 'Make a test with AI' });
    await form.getByLabel('MCQs').fill('10');
    await form.getByLabel('Theory questions').fill('2');
    await form.getByRole('button', { name: 'Make test' }).click();
    await expect(teacher).toHaveURL(/\/tests\/[0-9a-f-]{36}\?ok=ai_test_made$/);
    testId = new URL(teacher.url()).pathname.split('/').pop()!;
    const tst = testId;

    // A draft test for the subject's own batch, with every question an AI draft (MCQ 4 marks, theory 5).
    expect(await one('select status from tests where id = $1', [tst])).toEqual({ status: 'draft' });
    const audience = await sql(
      'select b.name from test_audience a join batches b on b.id = a.batch_id where test_id = $1',
      [tst],
    );
    expect(audience.rows).toEqual([{ name: 'JEE 2027 Morning' }]);
    const made = (
      await sql(
        `select q.id, q.stem, q.type, q.status, q.verification, q.subject_id, q.chapter_id, tq.marks::float as marks
         from test_questions tq join questions q on q.id = tq.question_id where tq.test_id = $1 order by q.stem`,
        [tst],
      )
    ).rows as {
      id: string;
      stem: string;
      type: string;
      status: string;
      verification: string;
      subject_id: string;
      chapter_id: string;
      marks: number;
    }[];
    const mcqs = made.filter((q) => q.type === 'single');
    const theory = made.filter((q) => q.type === 'written');
    expect(mcqs.length).toBeGreaterThan(0);
    expect(theory.length).toBe(2);
    expect(made.every((q) => q.status === 'draft')).toBe(true);
    expect(made.every((q) => (q.type === 'written' ? q.marks === 5 : q.marks === 4))).toBe(true);
    expect(theory.every((q) => q.verification === 'unverified')).toBe(true);
    expect(made.every((q) => q.subject_id === subject && q.chapter_id === topic)).toBe(true);
    const usage = await one(
      `select count(*)::int as n from usage_records where feature = 'question_gen' and created_at >= $1`,
      [start],
    );
    expect(usage.n).toBe(3); // MCQs: one write + one blind solve; theory: one write (no blind solve)
    const flagged = mcqs.find((q) => q.verification === 'dual_solve_disagree')!;
    const matched = mcqs.find((q) => q.verification === 'dual_solve_agree')!;
    expect([flagged, matched].every(Boolean)).toBe(true);

    const row = (stem: string) => teacher.getByRole('row').filter({ hasText: stem.slice(0, 40) });
    await expect(row(flagged.stem).getByText('answers differ, fix before use')).toBeVisible();
    await expect(row(flagged.stem).getByRole('button', { name: /^Approve/ })).toHaveCount(0);
    await expect(row(theory[0]!.stem).getByText('not checked, check it')).toBeVisible();
    await expect(row(theory[0]!.stem).getByRole('button', { name: /^Approve/ })).toHaveCount(0);

    // Not through the API either.
    const api = await signedIn('teacher1@demo.test');
    for (const q of [flagged, theory[0]!]) {
      const forced = await api.from('questions').update({ status: 'approved' }).eq('id', q.id);
      expect(forced.error?.message).toBe('question_not_verified');
    }

    // Scheduling is refused while any question is unapproved.
    await teacher.getByRole('button', { name: 'Schedule' }).click();
    await expect(teacher).toHaveURL(/error=test_question_not_ready$/);
    expect(await one('select status from tests where id = $1', [tst])).toEqual({ status: 'draft' });

    // A matched MCQ is approved with one click on the test page.
    await row(matched.stem)
      .getByRole('button', { name: /^Approve/ })
      .click();
    await expect(teacher.getByRole('status')).toHaveText('Approved. It can now be added to tests.');
    await expect(teacher).toHaveURL(new RegExp(`/tests/${tst}\\?ok=approved$`));

    // The flagged MCQ shows both answers; saving it (after checking) approves it and returns to the test.
    await teacher.goto(`${DEMO}/questions/${flagged.id}`);
    await expect(teacher.getByText(/answered [A-D], but the key says [A-D]/)).toBeVisible();
    await teacher.getByRole('button', { name: 'Save question' }).click();
    await expect(teacher).toHaveURL(new RegExp(`/tests/${tst}\\?ok=saved$`));
    // A theory question shows its model answer; saving approves it.
    for (const q of theory) {
      await teacher.goto(`${DEMO}/questions/${q.id}`);
      await expect(teacher.getByLabel(/^Model answer/)).not.toHaveValue('');
      await teacher.getByRole('button', { name: 'Save question' }).click();
      await expect(teacher).toHaveURL(new RegExp(`/tests/${tst}\\?ok=saved$`));
    }
    const rest = mcqs.filter((q) => q.verification === 'dual_solve_agree' && q.id !== matched.id).map((q) => q.id);
    if (rest.length)
      expect((await api.from('questions').update({ status: 'approved' }).in('id', rest)).error).toBeNull();
    const others = mcqs.filter((q) => q.verification === 'dual_solve_disagree' && q.id !== flagged.id);
    for (const q of others) {
      await teacher.goto(`${DEMO}/questions/${q.id}`);
      await teacher.getByRole('button', { name: 'Save question' }).click();
      await expect(teacher).toHaveURL(new RegExp(`/tests/${tst}\\?ok=saved$`));
    }
    const after = await sql(
      `select q.type, q.status, q.verification from test_questions tq join questions q on q.id = tq.question_id
       where tq.test_id = $1 and q.id = any($2)`,
      [tst, [flagged.id, matched.id, ...theory.map((q) => q.id)]],
    );
    expect(after.rows.every((r) => r.status === 'approved')).toBe(true);
    expect(after.rows.filter((r) => r.verification === 'teacher_verified').length).toBe(3);

    // Now it schedules; students of the batch see it on their home page.
    await teacher.getByRole('button', { name: 'Schedule' }).click();
    await expect(teacher.getByRole('status')).toHaveText('Test scheduled. Students see it on their home page.');
    const student = await (await browser.newContext()).newPage();
    await login(student, 'student01@demo.test');
    await expect(student.getByText('Rotational Motion — AI test')).toBeVisible();

    // Students cannot make AI tests or spend AI on questions; another institute cannot see them.
    const studentApi = await signedIn('student01@demo.test');
    const item = { type: 'written', stem: 'x', verification: 'unverified', key: { model_answer: 'x' }, marks: 5 };
    const stored = await studentApi.rpc('add_ai_test', {
      inst,
      subject,
      chapter: topic,
      title: 'x',
      opens: new Date().toISOString(),
      closes: new Date(Date.now() + 3_600_000).toISOString(),
      seconds: 600,
      items: [item],
    });
    expect(stored.error?.code).toBe('42501');
    const reserve = await studentApi.rpc('ai_reserve', {
      inst,
      feat: 'question_gen',
      prov: 'fake',
      mdl: 'fake',
      reserve: 1,
    });
    expect(reserve.error?.code).toBe('42501');
    const rival = await (await browser.newContext()).newPage();
    await login(rival, 'owner@rival.test', RIVAL);
    expect((await rival.goto(`${RIVAL}/tests/${tst}`))?.status()).toBe(404);
    expect((await rival.goto(`${RIVAL}/questions/${flagged.id}`))?.status()).toBe(404);
    const rivalApi = await signedIn('owner@rival.test');
    expect((await rivalApi.from('question_keys').select('second_solve').eq('question_id', flagged.id)).data).toEqual(
      [],
    );
  } finally {
    if (testId) await sql('delete from tests where id = $1', [testId]);
    await sql(`delete from questions where origin = 'ai' and created_at >= $1`, [start]);
  }
});
