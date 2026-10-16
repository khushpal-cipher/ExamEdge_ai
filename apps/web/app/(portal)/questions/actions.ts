'use server';

// AI-made bank questions (ADR-032). The institute comes from the host and every read/write runs in the staff member's
// own session: RLS decides which notes they may use and where the questions go; the database stores them as drafts.
import { redirect } from 'next/navigation';
import { AiBlocked } from '@examedge/core/ai/gateway';
import {
  generateQuestions as generate,
  keyOf,
  QTYPES,
  QuestionError,
  secondOf,
  type QType,
} from '@examedge/core/ai/questions';
import { log } from '@examedge/core/log';
import { webMeter } from '@/lib/meter';
import { chapterNotes } from '@/lib/notes';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { done } from '../form';

const back = (path: string, code: string): never => redirect(`${path}&error=${code}`);

export async function generateQuestions(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const subject = form.get('subject_id');
  const chapter = form.get('chapter_id');
  const type = form.get('type') as QType;
  const difficulty = String(form.get('difficulty'));
  if (!isUuid(subject)) redirect('/questions');
  const here = `/questions?subject=${subject}`;
  if (!isUuid(chapter) || !QTYPES.includes(type) || !['easy', 'medium', 'hard'].includes(difficulty))
    back(here, 'invalid');

  // RLS: the chapter is visible only to staff of this institute.
  const { data: ch } = await db
    .from('chapters')
    .select('name')
    .eq('institute_id', institute.id)
    .eq('subject_id', subject)
    .eq('id', chapter)
    .maybeSingle();
  if (!ch) back(here, 'denied');
  const { sources } = await chapterNotes(db, institute.id, chapter as string);
  if (!sources.length) back(here, 'no_sources');

  let made;
  try {
    made = await generate(webMeter(db, institute.id), {
      type,
      count: Number(form.get('count')),
      difficulty,
      chapter: ch!.name,
      sources,
    });
  } catch (e) {
    if (e instanceof AiBlocked) back(here, e.reason);
    if (e instanceof QuestionError) back(here, e.message === 'no_sources' ? 'no_sources' : 'no_questions');
    log.error('questions.generate_failed', { institute: institute.id, type, error: e });
    back(here, 'generation_failed');
  }
  if (!made!.solved) log.warn('questions.second_solve_failed', { institute: institute.id, type });
  const items = made!.questions.map((q) => ({
    type,
    stem: q.stem,
    options: q.options,
    explanation: q.explanation,
    difficulty,
    verification: q.verification,
    key: keyOf(type, q),
    second_solve: secondOf(type, q.second),
  }));
  const { error } = await db.rpc('add_ai_questions', { inst: institute.id, subject, chapter, items });
  done(here, error, 'questions_made');
}

// Approves a checked AI draft; the database refuses one whose second answer differed or is missing.
export async function approveQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('question_id');
  const path = String(form.get('back') ?? '');
  const to = /^\/questions(\/[0-9a-f-]{36}|\?subject=[0-9a-f-]{36})?$/.test(path) ? path : '/questions';
  if (!isUuid(id)) done(to, { code: '23514' });
  const { error } = await db
    .from('questions')
    .update({ status: 'approved' })
    .eq('institute_id', institute.id)
    .eq('id', id)
    .eq('status', 'draft');
  done(to, error, 'approved');
}
