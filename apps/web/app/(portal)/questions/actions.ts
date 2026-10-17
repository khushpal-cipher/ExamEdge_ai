'use server';

// AI-made questions (ADR-032, ADR-039: made as an AI test inside a topic). The institute comes from the host and every read/write runs in the staff member's
// own session: RLS decides which notes they may use and where the questions go; the database stores them as drafts.
import { redirect } from 'next/navigation';
import { AiBlocked } from '@examedge/core/ai/gateway';
import {
  generateQuestions as generate,
  keyOf,
  MAX_COUNT,
  QuestionError,
  secondOf,
  type GenType,
} from '@examedge/core/ai/questions';
import { log } from '@examedge/core/log';
import { webMeter } from '@/lib/meter';
import { chapterNotes } from '@/lib/notes';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { done } from '../form';

const IST = '+05:30';

// AI test (ADR-039): MCQs and/or theory questions made from a topic's published notes, stored with a new draft test
// for the subject's own batch. The teacher checks every question and schedules the test (scheduling refuses
// unapproved questions). Default times: tomorrow 10:00–11:00 India time; the teacher changes them on the test page.
export async function makeAiTest(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const chapter = form.get('chapter_id');
  if (!isUuid(chapter)) redirect('/subjects');
  const here = `/topics/${chapter}`;
  const back = (code: string): never => redirect(`${here}?error=${code}`);
  const difficulty = String(form.get('difficulty'));
  const counts = { single: Number(form.get('mcq')) || 0, written: Number(form.get('theory')) || 0 };
  const asked = (Object.entries(counts) as [GenType, number][]).filter(([, n]) => n > 0);
  if (!['easy', 'medium', 'hard'].includes(difficulty) || !asked.length || asked.some(([, n]) => n > MAX_COUNT))
    back('invalid');

  // RLS: the topic is visible only to staff of this institute.
  const { data: ch } = await db
    .from('chapters')
    .select('name, subject_id')
    .eq('institute_id', institute.id)
    .eq('id', chapter)
    .maybeSingle();
  if (!ch) back('denied');
  const { sources } = await chapterNotes(db, institute.id, chapter as string);
  if (!sources.length) back('no_sources');

  const meter = webMeter(db, institute.id);
  const items = [];
  let missing = false;
  for (const [type, count] of asked) {
    try {
      const made = await generate(meter, { type, count, difficulty, chapter: ch!.name, sources });
      if (!made.solved && type !== 'written') log.warn('questions.second_solve_failed', { institute: institute.id });
      for (const q of made.questions)
        items.push({
          type,
          stem: q.stem,
          options: q.options,
          explanation: q.explanation,
          difficulty,
          verification: q.verification,
          key: keyOf(type, q),
          second_solve: secondOf(type, q.second),
          marks: type === 'written' ? 5 : 4,
        });
    } catch (e) {
      if (e instanceof AiBlocked) back(e.reason);
      if (!(e instanceof QuestionError))
        log.error('questions.generate_failed', { institute: institute.id, type, error: e });
      missing = true;
    }
  }
  if (!items.length) back('no_questions');

  const day = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { data: test, error } = await db.rpc('add_ai_test', {
    inst: institute.id,
    subject: ch!.subject_id,
    chapter,
    title: `${ch!.name} — AI test`,
    opens: `${day}T10:00:00${IST}`,
    closes: `${day}T11:00:00${IST}`,
    seconds: 3600,
    items,
  });
  if (error) done(here, error);
  redirect(`/tests/${test}?ok=${missing ? 'ai_test_partial' : 'ai_test_made'}`);
}

// Approves a checked AI draft; the database refuses one whose second answer differed or is missing.
export async function approveQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('question_id');
  const path = String(form.get('back') ?? '');
  const to = /^(\/questions(\/[0-9a-f-]{36}|\?subject=[0-9a-f-]{36})?|\/tests\/[0-9a-f-]{36})$/.test(path)
    ? path
    : '/questions';
  if (!isUuid(id)) done(to, { code: '23514' });
  const { error } = await db
    .from('questions')
    .update({ status: 'approved' })
    .eq('institute_id', institute.id)
    .eq('id', id)
    .eq('status', 'draft');
  done(to, error, 'approved');
}
