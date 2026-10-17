// Phase 6 journeys: a student asks the tutor and gets a page-cited answer, reports it, a teacher resolves the report;
// chats stay private (staff and other institutes read nothing); the daily limit message; foreign Origin → 403.
// Needs `npm run seed:demo` (published notes are processed by the seed).
import { expect, test, type Page } from '@playwright/test';
import { demoSignIn, demoTopic, signedIn, sql } from './helpers';

const DEMO = 'http://demo.localhost:3000';

async function login(page: Page, email: string) {
  await page.goto(`${DEMO}/`);
  await demoSignIn(page, email);
  await expect(page).toHaveURL(/\/(home|dashboard)$/);
}

const rotation = () => demoTopic('Physics', 'Rotational Motion');

// Smart Study tab of a topic page (ADR-038).
async function smartStudy(page: Page) {
  await page.getByRole('tab', { name: 'Smart Study' }).click();
  return page.getByRole('tabpanel', { name: 'Smart Study' });
}

async function ask(page: Page, question: string) {
  const tutor = await smartStudy(page);
  const newChat = tutor.getByRole('button', { name: 'New chat' });
  if (await newChat.isVisible()) await newChat.click();
  await tutor.getByLabel('Your doubt').fill(question);
  await tutor.getByRole('button', { name: 'Ask', exact: true }).click();
  return tutor;
}

test('student gets a page-cited answer and reports it; the teacher sees and resolves the report', async ({ page }) => {
  const { subject, topic } = await rotation();
  const reason = `Check the formula ${Date.now()}`;
  await login(page, 'student05@demo.test');
  await page.goto(`${DEMO}/topics/${topic}`);
  const tutor = await ask(page, 'What is torque?');
  const chip = tutor.getByRole('link', { name: /From your institute's notes: Rotational Motion .*, p\.1/ }).first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('href', /^\/documents\/[0-9a-f-]{36}\/file#page=1$/);
  await expect(tutor.getByLabel('Your doubt')).toBeFocused();

  await tutor.getByRole('button', { name: 'Helpful', exact: true }).click();
  await expect(tutor.getByRole('button', { name: 'Helpful', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tutor.getByRole('button', { name: 'Report answer' }).click();
  await tutor.getByLabel('What looks wrong? (optional)').fill(reason);
  await tutor.getByRole('button', { name: 'Send report' }).click();
  await expect(tutor.getByText('Reported. Your teacher will review it.')).toBeVisible();

  // The saved chat comes back after a reload.
  await page.reload();
  await expect((await smartStudy(page)).getByText('What is torque?')).toBeVisible();

  await page.context().clearCookies();
  await login(page, 'teacher1@demo.test');
  await page.goto(`${DEMO}/subjects/${subject}`);
  const report = page.getByRole('list', { name: 'Reported answers' }).getByRole('listitem').filter({ hasText: reason });
  await expect(report).toBeVisible();
  await expect(report.getByText('What is torque?')).toBeVisible();
  await report.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('Marked as resolved.')).toBeVisible();
  await expect(page.getByText(reason)).toHaveCount(0);
});

test('chats and reports stay private: staff and other institutes read no chat text (ADR-015, T-E2E-ISO-01)', async () => {
  // A private chat of student05 (fixture written as the database owner).
  const { subject, topic } = await rotation();
  const { rows } = await sql(
    `with c as (
       insert into conversations (institute_id, user_id, subject_id, chapter_id, title)
       select s.institute_id, u.id, s.id, $2, 'Private doubt' from subjects s, auth.users u
       where s.id = $1 and u.email = 'student05@demo.test'
       returning id, institute_id)
     insert into messages (institute_id, conversation_id, role, content)
     select institute_id, id, 'assistant', 'Private answer' from c returning id, conversation_id`,
    [subject, topic],
  );
  const { id: message, conversation_id: conversation } = rows[0] as { id: string; conversation_id: string };
  const owner = await signedIn('student05@demo.test');
  try {
    expect((await owner.from('messages').select('id').eq('id', message)).data).toEqual([{ id: message }]);
    expect((await owner.rpc('report_answer', { msg: message, why: 'fixture' })).error).toBeNull();

    const rival = await signedIn('student01@rival.test');
    for (const table of ['conversations', 'messages'] as const)
      expect((await rival.from(table).select('id').in('id', [message, conversation])).data).toEqual([]);
    expect((await rival.rpc('report_answer', { msg: message, why: null })).error).not.toBeNull();
    const rivalOwner = await signedIn('owner@rival.test');
    expect((await rivalOwner.from('answer_reports').select('id').eq('message_id', message)).data).toEqual([]);

    // Demo staff see the reported copy, never the chat itself.
    for (const email of ['teacher1@demo.test', 'owner@demo.test']) {
      const staff = await signedIn(email);
      expect((await staff.from('messages').select('id').eq('id', message)).data).toEqual([]);
      expect((await staff.from('conversations').select('id').eq('id', conversation)).data).toEqual([]);
      expect((await staff.from('answer_reports').select('answer').eq('message_id', message)).data).toEqual([
        { answer: 'Private answer' },
      ]);
    }
    // Another student of the same institute and batch cannot read, rate or report it.
    const classmate = await signedIn('student06@demo.test');
    expect((await classmate.from('messages').select('id').eq('id', message)).data).toEqual([]);
    expect((await classmate.from('answer_reports').select('id').eq('message_id', message)).data).toEqual([]);
    expect((await classmate.from('messages').update({ feedback: 'down' }).eq('id', message).select('id')).data).toEqual(
      [],
    );
  } finally {
    await sql('delete from answer_reports where message_id = $1', [message]);
    await sql('delete from conversations where id = $1', [conversation]);
  }
});

test('a student over the daily limit is told so and nothing is saved (T-SEC-12)', async ({ page }) => {
  const email = 'student07@demo.test';
  const counter = `insert into usage_counters (institute_id, user_id, day, counter_key, value)
     select i.id, u.id, (now() at time zone 'Asia/Kolkata')::date, 'messages', q.student_daily_messages
     from institutes i join institute_quotas q on q.institute_id = i.id, auth.users u
     where i.slug = 'demo' and u.email = $1
     on conflict (institute_id, user_id, day, counter_key) do update set value = excluded.value`;
  const clear = `delete from usage_counters where counter_key = 'messages'
     and user_id = (select id from auth.users where email = $1)`;
  await sql(counter, [email]);
  try {
    await login(page, email);
    await page.goto(`${DEMO}/topics/${(await rotation()).topic}`);
    const tutor = await ask(page, 'What is inertia?');
    await expect(tutor.getByRole('alert')).toHaveText("You've used today's AI limit. It resets tomorrow.");
    await expect(tutor.getByLabel('Your doubt')).toHaveValue('What is inertia?');
    const saved = await sql(
      `select count(*)::int as n from messages m join conversations c on c.id = m.conversation_id
       join auth.users u on u.id = c.user_id where u.email = $1 and m.content = 'What is inertia?'`,
      [email],
    );
    expect(saved.rows[0].n).toBe(0);
  } finally {
    await sql(clear, [email]);
  }
});

test('the tutor endpoint refuses a request from another origin', async ({ page }) => {
  await login(page, 'student05@demo.test');
  const { subject, topic } = await rotation();
  const body = { subjectId: subject, topicId: topic, question: 'What is torque?', premium: false };
  const foreign = await page.request.post(`${DEMO}/api/tutor`, {
    data: body,
    headers: { origin: 'http://rival.localhost:3000' },
  });
  expect(foreign.status()).toBe(403);
  expect(await foreign.json()).toEqual({ code: 'bad_origin' });
  expect(foreign.headers()['cache-control']).toBe('private, no-store');
  const missing = await page.request.post(`${DEMO}/api/tutor`, { data: body, headers: { origin: '' } });
  expect(missing.status()).toBe(403);
});
