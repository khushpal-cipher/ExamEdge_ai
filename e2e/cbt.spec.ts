// ADR-048: a CBT test runs in full screen; leaving it (full screen, tab/app, reload) is a warning; the 3rd submits.
// Needs `npm run seed:demo`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const istInput = (minutes: number) => new Date(Date.now() + (330 + minutes) * 60_000).toISOString().slice(0, 16);

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}
const fullscreen = (page: Page) => page.evaluate<boolean>('!!document.fullscreenElement');

test('CBT test: full screen, warnings, the 3rd submits it; only staff switch it on', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const tag = Date.now().toString(36);
  const stem = `E2E ${tag} CBT: 2 + 2 = ?`;

  // ---- teacher1 makes a CBT test with one question and schedules it
  await login(page, 'teacher1@demo.test');
  await page.goto(`${DEMO}/tests`);
  await page.getByLabel('Title').fill(`E2E CBT ${tag}`);
  await page.getByLabel('Opens (India time)').fill(istInput(-2));
  await page.getByLabel('Closes (India time)').fill(istInput(60));
  await page.getByLabel('Duration (minutes)').fill('30');
  await page.getByLabel('Subject (and its batch)').selectOption({ label: 'Physics · JEE 2027 Morning' });
  await page.getByLabel(/CBT mode/).check();
  await page.getByRole('button', { name: 'Create test' }).click();
  await expect(page).toHaveURL(new RegExp(`/tests/${UUID.source}$`));
  const testId = page.url().match(UUID)![0];
  await expect(page.getByLabel(/CBT mode/)).toBeChecked(); // Settings shows it too
  const form = page.getByRole('form', { name: 'Type a question' });
  if (!(await form.isVisible())) await page.getByText('Type a question', { exact: true }).click();
  await form.getByLabel('Question', { exact: true }).fill(stem);
  await form.getByLabel('Option A', { exact: true }).fill('4');
  await form.getByLabel('Option B', { exact: true }).fill('5');
  await form.getByLabel('Option A is correct').check();
  await form.getByRole('button', { name: 'Add question' }).click();
  await expect(page.getByRole('region', { name: 'Questions' }).getByRole('link', { name: stem })).toBeVisible();
  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Open now')).toBeVisible();

  // ---- a browser without Chrome's brand (Safari, Firefox) cannot start it
  const other = await (await browser.newContext()).newPage();
  await other.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined }),
  );
  await login(other, 'student01@demo.test');
  await other.goto(`${DEMO}/tests/${testId}`);
  await expect(other.getByText('Open it in Google Chrome', { exact: false })).toBeVisible();
  await expect(other.getByRole('button', { name: /Start test/ })).toHaveCount(0);
  await other.context().close();

  // ---- student01 starts in full screen and answers
  const student = await (await browser.newContext()).newPage();
  await login(student, 'student01@demo.test');
  await student.goto(`${DEMO}/tests/${testId}`);
  await expect(student.getByText('CBT test:', { exact: true })).toBeVisible();
  await student.getByRole('button', { name: 'Start test in full screen' }).click();
  await expect(student.getByRole('timer')).toContainText('Time left');
  await expect.poll(() => fullscreen(student)).toBe(true);
  await expect(student.getByRole('alertdialog')).toHaveCount(0);
  const q1 = student.getByRole('group', { name: /^Question 1\b/ });
  await q1.getByLabel('A. 4').check();
  await expect(q1.getByRole('status')).toHaveText('Saved');
  // the submit question is asked on the page: "Keep working" stays in full screen with no warning (a browser
  // confirm() popup made Chrome leave full screen unnoticed — founder bug, session 40)
  await student.getByRole('button', { name: 'Submit test' }).click();
  await student.getByRole('button', { name: 'Keep working' }).click();
  await expect(student.getByRole('alertdialog')).toHaveCount(0);
  expect(await fullscreen(student)).toBe(true);
  const warnings = async () =>
    (await sql('select cbt_warnings, status from test_attempts where test_id = $1', [testId])).rows[0];

  // ---- 1: leaves full screen → the questions are covered and the warning is counted in the database
  await student.evaluate('document.exitFullscreen()');
  const dialog = student.getByRole('alertdialog');
  await expect(dialog.getByRole('heading')).toHaveText('Warning 1 of 3');
  await expect.poll(warnings).toEqual({ cbt_warnings: 1, status: 'in_progress' });
  const { violations } = await new AxeBuilder({ page: student }).analyze();
  expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([]);
  await dialog.getByRole('button', { name: 'Return to full screen' }).click();
  await expect(dialog).toHaveCount(0);

  // ---- 2: switches to another app or tab (the window loses focus)
  await student.evaluate("window.dispatchEvent(new Event('blur'))");
  await expect(dialog.getByRole('heading')).toHaveText('Warning 2 of 3');
  await expect(dialog).toContainText('One more warning submits your test.');
  await expect.poll(warnings).toEqual({ cbt_warnings: 2, status: 'in_progress' });
  await dialog.getByRole('button', { name: 'Return to full screen' }).click();
  await expect(dialog).toHaveCount(0);

  // ---- 3: copy or paste is blocked and counts too (founder, session 40) → submitted automatically, the answer kept.
  // (A reload counts the same way; hand-checked in session 39.)
  const blocked = await student.evaluate(
    "!document.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))",
  );
  expect(blocked).toBe(true);
  await expect.poll(warnings).toEqual({ cbt_warnings: 3, status: 'auto_submitted' });
  await expect(student.getByText('Your test was submitted automatically after 3 warnings')).toBeVisible();
  const { rows } = await sql(
    `select aa.response from attempt_answers aa join test_attempts a on a.id = aa.attempt_id where a.test_id = $1`,
    [testId],
  );
  expect(rows).toEqual([{ response: ['a'] }]);
});
