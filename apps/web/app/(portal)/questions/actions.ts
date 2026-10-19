'use server';

// AI-made questions (ADR-032; R1.2: made on a draft test's page from the teacher's request, ADR-042). The institute comes from the host and every read/write runs in the staff member's
// own session: RLS decides which notes they may use and where the questions go; the database stores them as drafts.
import { redirect } from 'next/navigation';
import { AiBlocked } from '@examedge/core/ai/gateway';
import { MAX_REQUEST, PlanError, planTest } from '@examedge/core/ai/plan';
import { generateQuestions as generate, keyOf, QuestionError, secondOf } from '@examedge/core/ai/questions';
import { log } from '@examedge/core/log';
import { brokenMath, questionTexts } from '@/lib/markdown';
import { webMeter } from '@/lib/meter';
import { chapterNotes } from '@/lib/notes';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { done } from '../form';

// "With AI" on a draft test's page (ADR-042): the teacher's request → a plan over the test subject's topics → each
// part's questions from that topic's published notes → added to the test in one transaction. The teacher checks every
// AI question and schedules the test (scheduling refuses unapproved questions).
export async function addAiQuestions(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const test = form.get('test_id');
  if (!isUuid(test)) redirect('/tests');
  const here = `/tests/${test}`;
  const back = (code: string): never => redirect(`${here}?error=${code}`);
  const request = String(form.get('request') ?? '').slice(0, MAX_REQUEST);
  if (!request.trim()) back('plan_unclear');

  // RLS: the test is visible to staff who may see it; the RPC re-checks that the caller may manage this draft.
  const { data: t } = await db
    .from('tests')
    .select('subject_id, status')
    .eq('institute_id', institute.id)
    .eq('id', test)
    .maybeSingle();
  if (!t?.subject_id || t.status !== 'draft') back('denied');
  const { data: topics } = await db
    .from('chapters')
    .select('id, name')
    .eq('institute_id', institute.id)
    .eq('subject_id', t!.subject_id)
    .order('position')
    .order('name');
  if (!topics?.length) back('no_topics');

  const meter = webMeter(db, institute.id);
  let plan;
  try {
    plan = await planTest(meter, { request, topics: topics!.map((c) => c.name) });
  } catch (e) {
    if (e instanceof AiBlocked) back(e.reason);
    if (e instanceof PlanError) back(`plan_${e.reason}`);
    throw e;
  }
  const items = [];
  let missing = false;
  let noNotes = false;
  for (const part of plan.parts) {
    const topic = topics![part.topic]!;
    const { sources } = await chapterNotes(db, institute.id, topic.id);
    if (!sources.length) {
      missing = noNotes = true;
      continue;
    }
    try {
      const { type, count } = part;
      const made = await generate(meter, { type, count, difficulty: plan.difficulty, chapter: topic.name, sources });
      if (!made.solved && part.type !== 'written')
        log.warn('questions.second_solve_failed', { institute: institute.id });
      for (const q of made.questions)
        items.push({
          origin: 'ai',
          chapter_id: topic.id,
          type: part.type,
          stem: q.stem,
          options: q.options,
          explanation: q.explanation,
          difficulty: plan.difficulty,
          verification: q.verification,
          key: keyOf(part.type, q),
          second_solve: secondOf(part.type, q.second),
          marks: part.type === 'written' ? 5 : 4,
        });
    } catch (e) {
      if (e instanceof AiBlocked) back(e.reason);
      if (!(e instanceof QuestionError))
        log.error('questions.generate_failed', { institute: institute.id, type: part.type, error: e });
      missing = true;
    }
  }
  if (!items.length) back(noNotes ? 'no_sources' : 'no_questions');

  // Checked as they are saved (ADR-054): a draft with a formula KaTeX cannot draw is flagged on the page and cannot be
  // approved until a teacher fixes it.
  const broken = items.filter((i) =>
    brokenMath(...questionTexts({ ...i, model_answer: 'model_answer' in i.key ? i.key.model_answer : null })),
  ).length;
  if (broken) log.warn('questions.formula_broken', { institute: institute.id, count: broken });

  const { error } = await db.rpc('add_test_questions', { inst: institute.id, test, items });
  if (error) done(here, error);
  redirect(`${here}?ok=${broken ? 'ai_questions_formula' : missing ? 'ai_questions_partial' : 'ai_questions_added'}`);
}

// Approves a checked AI draft; without `checked` the database refuses one whose second answer differed or is missing.
export async function approveQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('question_id');
  const path = String(form.get('back') ?? '');
  const to = /^(\/questions(\/[0-9a-f-]{36}|\?subject=[0-9a-f-]{36})?|\/tests\/[0-9a-f-]{36})$/.test(path)
    ? path
    : '/questions';
  if (!isUuid(id)) done(to, { code: '23514' });
  const { data: q } = await db
    .from('questions')
    .select('stem, options, explanation, question_keys(key)')
    .eq('institute_id', institute.id)
    .eq('id', id)
    .maybeSingle();
  const key = (q?.question_keys as { key?: { model_answer?: string } } | null)?.key;
  if (q && brokenMath(...questionTexts({ ...q, model_answer: key?.model_answer })))
    done(to, { message: 'formula_broken' });
  const { error } = await db
    .from('questions')
    // `checked`: approved after seeing it in full (question-preview), so a teacher vouches for it (ADR-052).
    .update(form.get('checked') ? { status: 'approved', verification: 'teacher_verified' } : { status: 'approved' })
    .eq('institute_id', institute.id)
    .eq('id', id)
    .eq('status', 'draft');
  done(to, error, 'approved');
}
