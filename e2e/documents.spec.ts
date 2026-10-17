// Phase 4 journeys: teacher uploads notes → worker reads them → publish to a batch → student opens the file →
// withdraw hides it at once (AC4.3); cross-tenant probes (AC4.4 web side) and signed URL rules (T-SEC-07).
// The worker runs in-process with `drain()`, as the worker role with its service account. Needs `npm run seed:demo`.
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { drain } from '../apps/worker/src/ingest';
import { workerDownloader } from '../apps/worker/src/storage';
import { makePdf } from '../scripts/make-pdf';
import { localWorkerEnv } from '../scripts/local-supabase';
import { demoSignIn, demoTopic, env, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';
const RIVAL = 'http://rival.localhost:3000';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function login(page: Page, base: string, email: string) {
  await page.goto(`${base}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

async function runWorker() {
  const workerEnv = localWorkerEnv(env as Record<string, string>);
  const pool = new pg.Pool({ connectionString: workerEnv.WORKER_DATABASE_URL, max: 2 });
  try {
    await drain({ pool, download: await workerDownloader(workerEnv) });
  } finally {
    await pool.end();
  }
}

test('teacher uploads, publishes and withdraws notes; student access follows (AC4.3)', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const title = `E2E notes ${Date.now().toString(36)}`;
  const { topic } = await demoTopic('Physics', 'Units and Measurement');

  // Notes go into a subtopic of the topic (ADR-038); the topic page opens on its Subtopics tab.
  await login(page, DEMO, 'teacher1@demo.test');
  await page.goto(`${DEMO}/topics/${topic}`);
  await page.getByRole('tabpanel', { name: 'Subtopics' }).getByText('Upload notes', { exact: true }).click();
  const upload = page.getByRole('form', { name: 'Upload notes' });
  await upload.getByLabel('Title').fill(title);
  await upload.getByLabel(/^File/).setInputFiles({
    name: 'units.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      makePdf([['Units and Measurement', 'Force is measured in newtons; [M L T^-2] is its dimension.']]),
    ),
  });
  await upload.getByRole('button', { name: 'Upload' }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${UUID.source}\\?ok=uploaded$`));
  const doc = page.url().match(UUID)![0];

  await runWorker();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Ready' })).toBeVisible();
  const chunks = await sql(`select count(*)::int as n from document_chunks where document_id = $1`, [doc]);
  expect(chunks.rows[0].n).toBeGreaterThan(0);

  await page.getByLabel('JEE 2027 Morning').check();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page).toHaveURL(/\?ok=published$/);

  // student01 is in JEE 2027 Morning: sees the notes and opens the file
  const student = await (await browser.newContext()).newPage();
  await login(student, DEMO, 'student01@demo.test');
  await student.goto(`${DEMO}/topics/${topic}`);
  await expect(student.getByRole('link', { name: title })).toHaveAttribute('href', `/documents/${doc}/file`);
  const file = await student.request.get(`${DEMO}/documents/${doc}/file`);
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('application/pdf');
  expect((await student.request.get(`${DEMO}/documents/${doc}`)).status()).toBe(404); // staff page

  // withdraw: the student loses the link and the file at once
  await page.getByRole('button', { name: /^Withdraw/ }).click();
  await expect(page).toHaveURL(/\?ok=withdrawn$/);
  await student.reload();
  await expect(student.getByRole('link', { name: title })).toHaveCount(0);
  expect((await student.request.get(`${DEMO}/documents/${doc}/file`, { maxRedirects: 0 })).status()).toBe(404);
});

test('Rival users cannot reach Demo notes (AC4.4, T-SEC-07)', async ({ page }) => {
  const { rows } = await sql(
    `select d.id, v.storage_path from documents d join document_versions v on v.id = d.current_version_id
     join institutes i on i.id = d.institute_id join subjects s on s.id = d.subject_id
     where i.slug = 'demo' and s.name = 'Physics' and d.status = 'published' limit 1`,
  );
  const { id, storage_path } = rows[0];

  await login(page, RIVAL, 'owner@rival.test');
  expect((await page.request.get(`${RIVAL}/documents/${id}`)).status()).toBe(404);
  expect((await page.request.get(`${RIVAL}/documents/${id}/file`, { maxRedirects: 0 })).status()).toBe(404);

  // raw Storage API: a Rival student cannot sign or download a Demo path
  const rival = await signedIn('student01@rival.test');
  expect((await rival.storage.from('documents').createSignedUrl(storage_path, 60)).data).toBeNull();
  expect((await rival.storage.from('documents').download(storage_path)).data).toBeNull();

  // a signed URL stops working once it expires
  const demo = await signedIn('student01@demo.test');
  const fresh = await demo.storage.from('documents').createSignedUrl(storage_path, 60);
  expect((await fetch(fresh.data!.signedUrl)).status).toBe(200);
  const { data, error } = await demo.storage.from('documents').createSignedUrl(storage_path, 1);
  expect(error).toBeNull();
  await new Promise((r) => setTimeout(r, 2_500));
  const expired = await fetch(data!.signedUrl);
  expect(expired.status).toBeGreaterThanOrEqual(400);
  expect(expired.status).toBeLessThan(500);
});
