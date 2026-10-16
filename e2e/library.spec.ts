// Phase 8 journeys: the platform admin (MFA) writes a library item, reviews and publishes it (AC8.2), a student's tutor
// cites it with an "ExamEdge library" chip that opens the item, an edit hides it again until re-reviewed; owners map a
// subject to the library, teachers only see the mapping. Needs `npm run seed:demo` (JEE Main Physics library seeded).
import { expect, test, type Page } from '@playwright/test';
import { DEMO_PASSWORD } from '../packages/core/src/demo';
import { admin, demoSignIn, sql } from './helpers';
import { totp } from './totp';

const DEMO = 'http://demo.localhost:3000';
const ADMIN = 'http://admin.localhost:3000';

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

const subjectId = async (name: string) =>
  (
    await sql(
      `select s.id from subjects s join institutes i on i.id = s.institute_id where i.slug = 'demo' and s.name = $1`,
      [name],
    )
  ).rows[0].id as string;

test('platform admin reviews and publishes a library item; the tutor cites it; an edit hides it again', async ({
  browser,
}) => {
  const tag = Date.now().toString(36);
  const word = `zorvex${tag}`;
  const topic = `E2E topic ${tag}`;
  const email = `librarian-${tag}@examedge.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  expect(error).toBeNull();
  await sql(`insert into private.platform_admins (user_id, granted_by) values ($1, 'e2e')`, [data.user!.id]);

  const page = await (await browser.newContext()).newPage();
  await page.goto(`${ADMIN}/`);
  await demoSignIn(page, email);
  await page.getByRole('button', { name: 'Set up authenticator' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!;
  await page.getByLabel('6-digit code from your authenticator app').fill(totp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Institutes');

  await page.getByRole('link', { name: 'ExamEdge library' }).click();
  await page.getByRole('link', { name: 'JEE Main · Physics' }).click();
  const gravitation = page.getByRole('region', { name: /Gravitation/ });
  await gravitation.getByLabel('New topic').fill(topic);
  await gravitation.getByRole('button', { name: 'Add topic' }).click();
  await page.getByRole('link', { name: topic }).click();

  await page.getByLabel('Kind').selectOption('explanation');
  await page.getByLabel(/^Text/).fill(`The ${word} effect is a made-up test phrase used only by the E2E suite.`);
  await page.getByLabel(/^Provenance/).fill('Written by the E2E suite; original text.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
  // The UI offers no Publish for a draft; the database refusal itself is pgTAP-tested (AC8.2).
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
  const itemId = new URL(page.url()).pathname.split('/').pop()!;

  await page.getByRole('button', { name: 'Mark as reviewed' }).click();
  await expect(page.getByRole('status')).toHaveText('Marked as reviewed by you.');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('status')).toContainText('Published.');
  const [row] = (
    await sql(
      `select i.status, i.reviewed_by, (select count(*)::int from library_chunks c where c.item_id = i.id) as chunks
       from library_items i where i.id = $1`,
      [itemId],
    )
  ).rows;
  expect(row).toEqual({ status: 'published', reviewed_by: data.user!.id, chunks: 1 });

  // A Demo student (Physics is mapped) gets a library-cited answer that opens the item.
  const student = await (await browser.newContext()).newPage();
  await login(student, 'student06@demo.test');
  await student.goto(`${DEMO}/subjects/${await subjectId('Physics')}`);
  const tutor = student.getByRole('tabpanel', { name: 'AI tutor' });
  const newChat = tutor.getByRole('button', { name: 'New chat' });
  if (await newChat.isVisible()) await newChat.click();
  await tutor.getByLabel('Your doubt').fill(`What is the ${word} effect?`);
  await tutor.getByRole('button', { name: 'Ask', exact: true }).click();
  const chip = tutor.getByRole('link', { name: `ExamEdge library: ${topic}` }).first();
  await expect(chip).toHaveAttribute('href', `/library/${itemId}`);
  // Chips open in a new tab so the chat stays open.
  const [item] = await Promise.all([student.waitForEvent('popup'), chip.click()]);
  await expect(item.getByRole('heading', { level: 1 })).toHaveText(topic);
  await expect(item.getByText(word)).toBeVisible();

  // Editing sends it back to draft: students lose it at once.
  await page.getByLabel(/^Text/).fill(`The ${word} effect, edited.`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('draft', { exact: true })).toBeVisible();
  expect((await student.goto(`${DEMO}/library/${itemId}`))?.status()).toBe(404);

  await sql(`delete from library_topics where name = $1`, [topic]);
});

test('owners map a subject to the library; teachers only see the mapping', async ({ page }) => {
  const chemistry = await subjectId('Chemistry');
  await login(page, 'teacher1@demo.test');
  await page.goto(`${DEMO}/subjects`);
  await expect(page.getByText('ExamEdge library: JEE Main · Physics')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'ExamEdge library' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).click();

  await login(page, 'owner@demo.test');
  await page.goto(`${DEMO}/subjects`);
  const card = page.getByRole('region', { name: 'Chemistry' });
  try {
    await card.getByRole('combobox', { name: 'ExamEdge library' }).selectOption({ label: 'JEE Main · Physics' });
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Saved.');
    const { rows } = await sql(`select library_subject_id is not null as mapped from subjects where id = $1`, [
      chemistry,
    ]);
    expect(rows[0].mapped).toBe(true);
  } finally {
    await sql(`update subjects set library_subject_id = null where id = $1`, [chemistry]);
  }
});
