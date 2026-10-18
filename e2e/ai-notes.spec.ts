// AI notes journey (ADR-039): a teacher explains a subtopic → the AI writes Markdown notes (a draft document) → the
// worker processes them like an upload → the teacher edits (a new version) and publishes → students of the batch read
// them as an in-app page; another batch, another institute and the API get nothing. Needs `npm run seed:demo`.
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, demoTopic, runWorker, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function login(page: Page, email: string, base = DEMO) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

test('teacher writes AI notes, edits and publishes them; only students of the batch read them', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const title = `AI notes ${Date.now().toString(36)}`;
  const { topic } = await demoTopic('Physics', 'Gravitation');
  const { start } = (await sql('select now() as start')).rows[0];
  let doc: string | undefined;
  try {
    await login(page, 'teacher1@demo.test');
    await page.goto(`${DEMO}/topics/${topic}`);
    const panel = page.getByRole('tabpanel', { name: 'Subtopics' });
    await panel.getByText('Write notes with AI', { exact: true }).first().click();
    const form = panel.getByRole('form', { name: /^Write notes with AI/ }).first();
    await form.getByLabel('Title').fill(title);
    await form
      .getByLabel('Explain this subtopic in your own words')
      .fill('Gravitation pulls every two masses together. g is about 9.8 m/s² on Earth.');
    await form.getByRole('button', { name: 'Write notes' }).click();
    await expect(page).toHaveURL(new RegExp(`/documents/${UUID.source}\\?ok=notes_written$`));
    doc = page.url().match(UUID)![0];
    const id = doc;
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
    await expect(page.getByText('Gravitation pulls every two masses together.').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upload a new version' })).toHaveCount(0);
    const usage = await sql(
      `select count(*)::int as n from usage_records where feature = 'notes_gen' and created_at >= $1`,
      [start],
    );
    expect(usage.rows[0].n).toBe(1);
    expect((await sql('select kind, status from documents where id = $1', [id])).rows).toEqual([
      { kind: 'ai_notes', status: 'draft' },
    ]);

    // The worker reads the Markdown as text (no OCR) and makes chunks for Smart Study.
    await runWorker();
    await page.reload();
    await expect(page.getByRole('cell', { name: 'Ready' })).toBeVisible();
    const chunks = await sql('select count(*)::int as n from document_chunks where document_id = $1', [id]);
    expect(chunks.rows[0].n).toBeGreaterThan(0);

    // Editing saves a new version; the editor shows the newest text.
    await page.getByText('Edit notes', { exact: true }).click();
    await page.getByLabel('Notes (Markdown)').fill(`# ${title}\n\nEdited by the teacher: orbits are ellipses.`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\?ok=notes_saved$/);
    await expect(page.getByText('Edited by the teacher: orbits are ellipses.').first()).toBeVisible();
    await runWorker();

    await page.getByLabel('JEE 2027 Morning').check();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\?ok=published$/);

    // student01 (JEE 2027 Morning) opens the notes page from the topic.
    const student = await (await browser.newContext()).newPage();
    await login(student, 'student01@demo.test');
    await student.goto(`${DEMO}/topics/${topic}`);
    await student.getByRole('link', { name: title }).click();
    await expect(student).toHaveURL(`${DEMO}/notes/${id}`);
    await expect(student.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(student.getByText('Edited by the teacher: orbits are ellipses.')).toBeVisible();
    await expect(student.getByRole('button', { name: 'Download as PDF' })).toBeVisible();
    expect((await student.request.get(`${DEMO}/documents/${id}`)).status()).toBe(404); // staff page

    // Another batch (NEET 2027 Evening) and another institute get nothing.
    for (const [email, base] of [
      ['student30@demo.test', DEMO],
      ['owner@rival.test', RIVAL],
    ] as const) {
      const other = await (await browser.newContext()).newPage();
      await login(other, email, base);
      expect((await other.goto(`${base}/notes/${id}`))?.status(), email).toBe(404);
      const db = await signedIn(email);
      expect((await db.from('documents').select('id').eq('id', id)).data, email).toEqual([]);
      await other.context().close();
    }
    // Students cannot spend the staff-only notes feature.
    const api = await signedIn('student01@demo.test');
    const { id: inst } = (await sql(`select id from institutes where slug = 'demo'`)).rows[0];
    const reserve = await api.rpc('ai_reserve', { inst, feat: 'notes_gen', prov: 'fake', mdl: 'fake', reserve: 1 });
    expect(reserve.error?.code).toBe('42501');
  } finally {
    if (doc) await sql('delete from documents where id = $1', [doc]);
  }
});
