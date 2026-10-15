'use server';

// Question bank, tests, checking and release (staff), and taking a test (students). Same rules as ../actions.ts:
// institute from the host, role re-checked here, RLS and the definer RPCs check everything again.
import { redirect } from 'next/navigation';
import { fromLocalInput } from '@/lib/assess';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { done, text } from '../form';

const TYPES = ['single', 'multi', 'numerical', 'written'];
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const num = (form: FormData, key: string) => {
  const v = text(form, key, 40);
  return v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
};

// ---------------------------------------------------------------- question bank
export async function saveQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('question_id');
  const subject = form.get('subject_id');
  const chapter = form.get('chapter_id');
  const type = text(form, 'type');
  const back = isUuid(subject) ? `/questions?subject=${subject}` : '/questions';
  if (!isUuid(subject) || !TYPES.includes(type)) done(back, { code: '23514' });

  const options = ['single', 'multi'].includes(type)
    ? OPTION_IDS.map((o) => ({ id: o, text: text(form, `option_${o}`, 1000) })).filter((o) => o.text)
    : [];
  const correct = form.getAll('correct').filter((c) => options.some((o) => o.id === c));
  const tolerance = num(form, 'tolerance');
  const key =
    type === 'written'
      ? { model_answer: text(form, 'model_answer', 5000) }
      : type === 'numerical'
        ? { value: num(form, 'value'), ...(tolerance ? { tolerance_abs: Math.abs(tolerance) } : {}) }
        : { correct };
  const row = {
    subject_id: subject,
    chapter_id: isUuid(chapter) ? chapter : null,
    type,
    stem: text(form, 'stem', 5000),
    options,
    explanation: text(form, 'explanation', 5000),
    difficulty: ['easy', 'medium', 'hard'].includes(text(form, 'difficulty')) ? text(form, 'difficulty') : 'medium',
  };

  let questionId = isUuid(id) ? id : null;
  if (questionId) {
    const { error } = await db.from('questions').update(row).eq('institute_id', institute.id).eq('id', questionId);
    if (error) done(`/questions/${questionId}`, error);
  } else {
    const { data, error } = await db
      .from('questions')
      .insert({ ...row, institute_id: institute.id })
      .select('id')
      .single();
    if (error) done(back, error);
    questionId = data!.id as string;
  }
  // Not an upsert: ON CONFLICT DO UPDATE would need UPDATE on question_id/institute_id, and only `key` is granted.
  const { data: updated, error: updateError } = isUuid(id)
    ? await db.from('question_keys').update({ key }).eq('question_id', questionId).select('question_id')
    : { data: [], error: null };
  const { error } =
    updateError || updated?.length
      ? { error: updateError }
      : await db.from('question_keys').insert({ question_id: questionId, institute_id: institute.id, key });
  if (error) done(`/questions/${questionId}`, error);
  done(back);
}

export async function deleteQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('question_id');
  if (!isUuid(id)) done('/questions', { code: '23514' });
  const { error } = await db.from('questions').delete().eq('institute_id', institute.id).eq('id', id);
  done('/questions', error, 'deleted');
}

// ---------------------------------------------------------------- tests
function times(form: FormData) {
  const opens = fromLocalInput(text(form, 'opens_at', 20));
  const closes = fromLocalInput(text(form, 'closes_at', 20));
  const minutes = num(form, 'duration_minutes');
  if (!opens || !closes || closes <= opens || !minutes || minutes < 1 || minutes > 1440) return null;
  return { opens_at: opens, closes_at: closes, duration_seconds: Math.round(minutes) * 60 };
}

export async function createTest(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const when = times(form);
  if (!when) redirect('/tests?error=time');
  const { data, error } = await db
    .from('tests')
    .insert({
      institute_id: institute.id,
      title: text(form, 'title', 200),
      shuffle_questions: form.get('shuffle') === 'on',
      ...when,
    })
    .select('id')
    .single();
  if (error) done('/tests', error);
  const batches = form.getAll('batch_id').filter(isUuid);
  if (batches.length) {
    const { error: e } = await db
      .from('test_audience')
      .insert(batches.map((b) => ({ test_id: data!.id, batch_id: b, institute_id: institute.id })));
    if (e) done(`/tests/${data!.id}`, e);
  }
  redirect(`/tests/${data!.id}`);
}

export async function updateTest(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  if (!isUuid(id)) done('/tests', { code: '23514' });
  const when = times(form);
  if (!when) redirect(`/tests/${id}?error=time`);
  const { error } = await db
    .from('tests')
    .update({ title: text(form, 'title', 200), shuffle_questions: form.get('shuffle') === 'on', ...when })
    .eq('institute_id', institute.id)
    .eq('id', id);
  done(`/tests/${id}`, error);
}

export async function setTestBatches(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  if (!isUuid(id)) done('/tests', { code: '23514' });
  const wanted = new Set(form.getAll('batch_id').filter(isUuid));
  const { data: current, error: readError } = await db
    .from('test_audience')
    .select('batch_id')
    .eq('institute_id', institute.id)
    .eq('test_id', id);
  if (readError) done(`/tests/${id}`, readError);
  const have = new Set(current!.map((r) => r.batch_id as string));
  const add = [...wanted].filter((b) => !have.has(b));
  const remove = [...have].filter((b) => !wanted.has(b));
  if (add.length) {
    const { error } = await db
      .from('test_audience')
      .insert(add.map((b) => ({ test_id: id, batch_id: b, institute_id: institute.id })));
    if (error) done(`/tests/${id}`, error);
  }
  if (remove.length) {
    const { error } = await db
      .from('test_audience')
      .delete()
      .eq('institute_id', institute.id)
      .eq('test_id', id)
      .in('batch_id', remove);
    if (error) done(`/tests/${id}`, error);
  }
  done(`/tests/${id}`);
}

export async function addTestQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  const question = form.get('question_id');
  if (!isUuid(id) || !isUuid(question)) done('/tests', { code: '23514' });
  const { data: last } = await db
    .from('test_questions')
    .select('position')
    .eq('test_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db.from('test_questions').insert({
    test_id: id,
    question_id: question,
    institute_id: institute.id,
    position: (last?.position ?? 0) + 1,
    marks: num(form, 'marks') ?? 4,
    negative_marks: num(form, 'negative_marks') ?? 0,
  });
  done(`/tests/${id}`, error);
}

export async function updateTestQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  const question = form.get('question_id');
  if (!isUuid(id) || !isUuid(question)) done('/tests', { code: '23514' });
  const { error } = await db
    .from('test_questions')
    .update({ marks: num(form, 'marks') ?? 0, negative_marks: num(form, 'negative_marks') ?? 0 })
    .eq('institute_id', institute.id)
    .eq('test_id', id)
    .eq('question_id', question);
  done(`/tests/${id}`, error);
}

export async function removeTestQuestion(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  const question = form.get('question_id');
  if (!isUuid(id) || !isUuid(question)) done('/tests', { code: '23514' });
  const { error } = await db
    .from('test_questions')
    .delete()
    .eq('institute_id', institute.id)
    .eq('test_id', id)
    .eq('question_id', question);
  done(`/tests/${id}`, error);
}

const STATUS_OK: Record<string, string> = { scheduled: 'scheduled', draft: 'saved', cancelled: 'cancelled' };

export async function setTestStatus(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  const status = text(form, 'status');
  if (!isUuid(id) || !STATUS_OK[status]) done('/tests', { code: '23514' });
  const { data, error } = await db
    .from('tests')
    .update({ status })
    .eq('institute_id', institute.id)
    .eq('id', id)
    .select('id');
  done(`/tests/${id}`, error ?? (data?.length ? null : { code: '42501' }), STATUS_OK[status]);
}

export async function deleteTest(form: FormData) {
  const { institute, db } = await requireMember(STAFF);
  const id = form.get('test_id');
  if (!isUuid(id)) done('/tests', { code: '23514' });
  const { error } = await db.from('tests').delete().eq('institute_id', institute.id).eq('id', id);
  done('/tests', error, 'deleted');
}

export async function releaseResults(form: FormData) {
  const { db } = await requireMember(STAFF);
  const id = form.get('test_id');
  if (!isUuid(id)) done('/tests', { code: '23514' });
  const { error } = await db.rpc('release_results', { t: id });
  done(`/tests/${id}`, error, 'released');
}

// The checking screen posts back to itself; the path is rebuilt from ids, never taken from the form.
export async function gradeAnswer(form: FormData) {
  const { db } = await requireMember(STAFF);
  const test = form.get('test_id');
  const attempt = form.get('attempt_id');
  const question = form.get('question_id');
  if (!isUuid(test) || !isUuid(attempt) || !isUuid(question)) done('/tests', { code: '23514' });
  const back = `/tests/${test}/check?q=${question}${form.get('names') === 'hidden' ? '&names=hidden' : ''}`;
  const marks = num(form, 'marks');
  const { error } = await db.rpc('grade_answer', {
    a: attempt,
    q: question,
    marks: marks ?? -1e9,
    comment: text(form, 'comment', 2000),
  });
  done(back, error);
}

// ---------------------------------------------------------------- students
export async function startAttempt(form: FormData) {
  const { db } = await requireMember(['student']);
  const id = form.get('test_id');
  if (!isUuid(id)) redirect('/home');
  const { error } = await db.rpc('start_attempt', { t: id });
  redirect(`/tests/${id}${error ? '?error=closed' : ''}`);
}

// Called from the test page on every change (autosave). Returns instead of redirecting.
export async function saveAnswer(attempt: string, question: string, response: unknown): Promise<{ ok: boolean }> {
  const { db } = await requireMember(['student']);
  if (!isUuid(attempt) || !isUuid(question)) return { ok: false };
  const { error } = await db.rpc('save_answer', { a: attempt, q: question, response: response ?? null });
  return { ok: !error };
}

export async function submitAttempt(form: FormData) {
  const { db } = await requireMember(['student']);
  const id = form.get('test_id');
  const attempt = form.get('attempt_id');
  if (!isUuid(id) || !isUuid(attempt)) redirect('/home');
  await db.rpc('submit_attempt', { a: attempt }); // already submitted / past deadline: the page shows the state
  redirect(`/tests/${id}`);
}
