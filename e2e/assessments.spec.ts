// Phase 7 journeys: test with typed questions (4 types, saved in the bank, ADR-042) → student attempt with autosave → checking → release → review,
// ranks and progress (AC7.7, AC7.8, AC7.9), cross-tenant probes (T-E2E-ISO-01), CSV headers (T-SEC-05) and axe.
// Needs `npm run seed:demo`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function login(page: Page, base: string, email: string) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

async function noSeriousA11yIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

// <input type="datetime-local"> value in India time, `minutes` from now.
const istInput = (minutes: number) => new Date(Date.now() + (330 + minutes) * 60_000).toISOString().slice(0, 16);

const userId = async (email: string) =>
  (await sql('select id from auth.users where email = $1', [email])).rows[0].id as string;

test('teacher builds a mixed test, student takes it, teacher checks and releases (AC7.7–AC7.9)', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const tag = Date.now().toString(36);
  const stems = {
    single: `E2E ${tag} single: 1 + 1 = ?`,
    multi: `E2E ${tag} multi: which are even?`,
    numerical: `E2E ${tag} numerical: g in m/s²`,
    written: `E2E ${tag} written: state Newton's first law`,
  };

  // ---- teacher1 (JEE 2027 Morning) makes a test that is open now (India time) for a subject (ADR-042)
  await login(page, DEMO, 'teacher1@demo.test');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tests' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tests');
  await noSeriousA11yIssues(page);
  await page.getByLabel('Title').fill(`E2E Test ${tag}`);
  await page.getByLabel('Opens (India time)').fill(istInput(-2));
  await page.getByLabel('Closes (India time)').fill(istInput(60));
  await page.getByLabel('Duration (minutes)').fill('30');
  // Subject names repeat per batch, so the list labels them with their batch (ADR-038).
  await page.getByLabel('Subject (and its batch)').selectOption({ label: 'Physics · JEE 2027 Morning' });
  await page.getByRole('button', { name: 'Create test' }).click();
  await expect(page).toHaveURL(new RegExp(`/tests/${UUID.source}$`));
  const testId = page.url().match(UUID)![0];

  // ---- and types one question of each type on the test page
  const form = page.getByRole('form', { name: 'Type a question' });
  const add = async (fill: () => Promise<void>, stem: string) => {
    if (!(await form.isVisible())) await page.getByText('Type a question', { exact: true }).click();
    await fill();
    await form.getByRole('button', { name: 'Add question' }).click();
    await expect(page.getByRole('status')).toHaveText('Question added to the test and saved in the question bank.');
    await expect(page.getByRole('region', { name: 'Questions' }).getByRole('link', { name: stem })).toBeVisible();
  };
  await add(async () => {
    await form.getByLabel('Question', { exact: true }).fill(stems.single);
    await form.getByLabel('Option A', { exact: true }).fill('2');
    await form.getByLabel('Option B', { exact: true }).fill('3');
    await form.getByLabel('Option A is correct').check();
    await form.getByLabel('Negative marks for a wrong answer').fill('-1'); // typed as minus: stored as 1;
  }, stems.single);
  await add(async () => {
    await form.getByRole('combobox', { name: 'Type' }).selectOption('multi');
    await form.getByLabel('Question', { exact: true }).fill(stems.multi);
    for (const [l, v] of [
      ['A', '2'],
      ['B', '3'],
      ['C', '4'],
    ])
      await form.getByLabel(`Option ${l}`, { exact: true }).fill(v!);
    await form.getByLabel('Option A is correct').check();
    await form.getByLabel('Option C is correct').check();
  }, stems.multi);
  await add(async () => {
    await form.getByRole('combobox', { name: 'Type' }).selectOption('numerical');
    await form.getByLabel('Question', { exact: true }).fill(stems.numerical);
    await form.getByLabel('Correct answer', { exact: true }).fill('9.8');
    await form.getByLabel('Allowed error (±)').fill('0.1');
  }, stems.numerical);
  await add(async () => {
    await form.getByRole('combobox', { name: 'Type' }).selectOption('written');
    await form.getByLabel('Question', { exact: true }).fill(stems.written);
    // The model answer is optional (founder, 2026-10-18): left blank here.
    await expect(form.getByLabel(/^Model answer \(optional/)).toBeVisible();
    await expect(form.getByLabel('Negative marks for a wrong answer')).toHaveCount(0);
  }, stems.written);
  await expect(page.getByLabel('Negative marks for question 1')).toHaveValue(/^1(\.0+)?$/);
  await expect(page.getByLabel('Negative marks for question 2')).toHaveValue(/^0(\.0+)?$/);
  await noSeriousA11yIssues(page);

  // The typed questions are saved in the bank too, for reuse.
  await page.goto(`${DEMO}/tests`);
  await page.getByRole('main').getByRole('link', { name: 'Question bank' }).click();
  await page
    .getByRole('navigation', { name: 'Subjects' })
    .getByRole('link', { name: 'Physics · JEE 2027 Morning' })
    .click();
  for (const stem of Object.values(stems)) await expect(page.getByRole('link', { name: stem })).toBeVisible();
  await page.goto(`${DEMO}/tests/${testId}`);
  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByRole('status')).toHaveText('Test scheduled. Students see it on their home page.');
  await expect(page.getByText('Open now')).toBeVisible();
  await noSeriousA11yIssues(page);

  // ---- student01 takes it: answers save automatically and survive a reload
  const student = await (await browser.newContext()).newPage();
  await login(student, DEMO, 'student01@demo.test');
  await student.goto(`${DEMO}/tests/${testId}`);
  await student.getByRole('button', { name: 'Start test' }).click();
  await expect(student.getByRole('timer')).toContainText('Time left');
  const q = (n: number) => student.getByRole('group', { name: new RegExp(`^Question ${n}\\b`) });
  await q(1).getByLabel('A. 2').check();
  await expect(q(1).getByRole('status')).toHaveText('Saved');
  await q(2).getByLabel('A. 2').check();
  await expect(q(2).getByRole('status')).toHaveText('Saved');
  await q(2).getByLabel('C. 4').check();
  await expect(q(2).getByRole('status')).toHaveText('Saved');
  await q(3).getByLabel('Your answer').fill('9.81');
  await expect(q(3).getByRole('status')).toHaveText('Saved');
  await q(4).getByLabel('Your answer').fill('An object keeps its state of motion unless a force acts on it.');
  await expect(q(4).getByRole('status')).toHaveText('Saved');
  await noSeriousA11yIssues(student);

  await student.reload();
  await expect(q(1).getByLabel('A. 2')).toBeChecked();
  await expect(q(2).getByLabel('A. 2')).toBeChecked();
  await expect(q(2).getByLabel('B. 3')).not.toBeChecked();
  await expect(q(2).getByLabel('C. 4')).toBeChecked();
  await expect(q(3).getByLabel('Your answer')).toHaveValue('9.81');
  await expect(q(4).getByLabel('Your answer')).toHaveValue(
    'An object keeps its state of motion unless a force acts on it.',
  );
  student.once('dialog', (d) => void d.accept());
  await student.getByRole('button', { name: 'Submit test' }).click();
  await expect(student.getByText(/^Submitted\./)).toBeVisible();

  // ---- the test closes (time travel; guard triggers would refuse to move an opened test's times)
  await sql(
    `begin; set local session_replication_role = replica;
     update public.tests set opens_at = now() - interval '2 hours', closes_at = now() - interval '1 minute'
     where id = '${testId}'; commit;`,
  );
  const { rows } = await sql(
    `select a.id as attempt, q.id as question from public.test_attempts a
     join public.test_questions tq on tq.test_id = a.test_id join public.questions q on q.id = tq.question_id
     where a.test_id = $1 and q.type = 'written'`,
    [testId],
  );
  const { attempt, question } = rows[0] as { attempt: string; question: string };

  // AC7.8: teacher3 teaches only NEET 2027 Evening — no checking screen, and the RPC refuses.
  const other = await (await browser.newContext()).newPage();
  await login(other, DEMO, 'teacher3@demo.test');
  expect((await other.goto(`${DEMO}/tests/${testId}/check`))?.status()).toBe(404);
  expect((await other.goto(`${DEMO}/tests/${testId}`))?.status()).toBe(404);
  const t3 = await signedIn('teacher3@demo.test');
  expect((await t3.rpc('grade_answer', { a: attempt, q: question, marks: 4, comment: '' })).error?.message).toBe(
    'not_allowed',
  );
  await other.context().close();

  // AC7.7: release stays disabled until the written answer is checked.
  await page.reload();
  await expect(page.getByText('0 of 1 checked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release results' })).toBeDisabled();
  await page.getByRole('link', { name: 'Check answers' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check answers');
  await page.getByRole('link', { name: 'Hide student names' }).click();
  await expect(page).toHaveURL(/names=hidden/);
  const card = page.getByRole('region', { name: /^Student 1/ });
  await expect(card).toContainText('An object keeps its state of motion');
  await noSeriousA11yIssues(page);
  await card.getByLabel('Marks (out of 4)').fill('2.5');
  await card.getByLabel('Comment for the student (optional)').fill('Mention inertia.');
  await card.getByRole('button', { name: 'Save marks for Student 1' }).click();
  // Re-rendered in place (no redirect), so the teacher keeps their place in a long list.
  await expect(card.getByText('Checked: 2.5')).toBeVisible();
  await expect(page.getByText('1 of 1 checked')).toBeVisible();
  await expect(page).toHaveURL(/names=hidden/);

  await page.goto(`${DEMO}/tests/${testId}`);
  await page.getByRole('button', { name: 'Release results' }).click();
  await expect(page.getByRole('status')).toHaveText('Results released. Ranks are updated.');
  const rankList = page.getByRole('region', { name: /^Rank list/ });
  await expect(rankList.getByRole('row')).toHaveCount(2);
  await expect(rankList.getByRole('row').nth(1)).toContainText('14.5 / 16');

  // CSV export: staff only, never cached.
  const csv = await page.request.get(`${DEMO}/tests/${testId}/export`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(csv.headers()['cache-control']).toContain('no-store');
  expect((await csv.text()).split('\r\n')[0]).toBe(
    'Rank,Student,Score,Max,Percentage,Percentile,Minutes taken,Submitted',
  );
  expect((await student.request.get(`${DEMO}/tests/${testId}/export`)).status()).toBe(404);

  // ---- student sees marks, rank, model answers and the teacher's comment
  await student.goto(`${DEMO}/tests/${testId}`);
  await expect(student.locator('.stat').filter({ hasText: 'Marks' })).toContainText('14.5 / 16');
  await expect(student.locator('.stat').filter({ hasText: 'Test rank' })).toContainText('1');
  await expect(student.getByText("Teacher's comment: Mention inertia.")).toBeVisible();
  await noSeriousA11yIssues(student);

  // AC7.9: "My progress" shows the same numbers as the teacher's view of the student.
  await student.goto(`${DEMO}/progress`);
  await expect(student.getByRole('heading', { level: 1 })).toHaveText('My progress');
  await expect(student.getByRole('region', { name: 'Institute tests' })).toContainText(`E2E Test ${tag}`);
  await noSeriousA11yIssues(student);
  await page.goto(`${DEMO}/students/${await userId('student01@demo.test')}`);
  for (const name of ['Summary', 'Institute tests', 'Topic strength', 'Question types', 'Teacher comments'])
    expect(await page.getByRole('region', { name }).innerText(), name).toBe(
      await student.getByRole('region', { name }).innerText(),
    );
  await student.context().close();
});

test('another institute cannot reach Demo Classes tests (T-E2E-ISO-01, T-ISO-14)', async ({ page }) => {
  const { rows } = await sql(
    `select t.id, t.institute_id from public.tests t join public.institutes i on i.id = t.institute_id
     where i.slug = 'demo' and t.title = 'Chemistry Test 3'`,
  );
  const { id, institute_id: demo } = rows[0] as { id: string; institute_id: string };
  await login(page, RIVAL, 'owner@rival.test');
  for (const path of [`/tests/${id}`, `/tests/${id}/check`, `/tests/${id}/export`])
    expect((await page.goto(`${RIVAL}${path}`))?.status(), path).toBe(404);

  const rival = await signedIn('owner@rival.test');
  expect((await rival.from('tests').select('id').eq('id', id)).data).toEqual([]);
  expect((await rival.from('question_keys').select('question_id').eq('institute_id', demo)).data).toEqual([]);
  const student = await signedIn('student01@demo.test');
  expect((await student.from('question_keys').select('question_id')).data).toEqual([]);
});
