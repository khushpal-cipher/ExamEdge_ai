import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown, MathText } from '@/lib/markdown';
import { isUuid, requireMember, STAFF } from '@/lib/tenant';
import { Flash } from '../../../flash';
import { gradeAnswer } from '../../actions';

type Answer = {
  attempt_id: string;
  question_id: string;
  response: unknown;
  marks_awarded: number | null;
  teacher_comment: string | null;
  test_attempts: { user_id: string };
};

// Checking screen (HOW_IT_WORKS 2D): one written question at a time across all students. RLS shows a teacher only
// the answers of students in their own batches; grade_answer re-checks that (AC7.8).
export default async function Check({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; names?: string; ok?: string; error?: string }>;
}) {
  const { institute, db } = await requireMember(STAFF);
  const { id } = await params;
  const { q, names } = await searchParams;
  if (!isUuid(id)) notFound();
  const [{ data: test }, { data: tqs }] = await Promise.all([
    db.from('tests').select('id, title').eq('institute_id', institute.id).eq('id', id).maybeSingle(),
    db
      .from('test_questions')
      .select('question_id, position, marks, questions!inner(stem, type, question_keys(key))')
      .eq('test_id', id)
      .eq('questions.type', 'written')
      .order('position'),
  ]);
  if (!test) notFound();
  const written = (tqs ?? []) as unknown as {
    question_id: string;
    marks: number;
    questions: { stem: string; question_keys: { key: { model_answer?: string } } | null };
  }[];
  if (written.length === 0) notFound();
  const current = written.find((w) => w.question_id === q) ?? written[0]!;
  const hide = names === 'hidden';

  const [{ data: all }, { data: profiles }] = await Promise.all([
    db
      .from('attempt_answers')
      .select(
        'attempt_id, question_id, response, marks_awarded, teacher_comment, test_attempts!inner(user_id, test_id)',
      )
      .eq('test_attempts.test_id', id)
      .in(
        'question_id',
        written.map((w) => w.question_id),
      )
      .order('attempt_id'),
    hide ? Promise.resolve({ data: [] }) : db.from('profiles').select('user_id, full_name'),
  ]);
  const answers = (all ?? []) as unknown as Answer[];
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Unnamed']));
  const mine = answers.filter((a) => a.question_id === current.question_id);
  const checked = answers.filter((a) => a.marks_awarded != null).length;
  const query = (qid: string, hidden = hide) => `/tests/${id}/check?q=${qid}${hidden ? '&names=hidden' : ''}`;

  return (
    <>
      <div className="top">
        <div>
          <p className="small">
            <Link href={`/tests/${id}`}>{test.title}</Link>
          </p>
          <h1>Check answers</h1>
          <p>
            <b>
              {checked} of {answers.length} checked
            </b>
          </p>
          <progress value={checked} max={Math.max(answers.length, 1)} aria-label="Written answers checked" />
        </div>
        <Link href={query(current.question_id, !hide)} className="button">
          {hide ? 'Show student names' : 'Hide student names'}
        </Link>
      </div>
      <Flash searchParams={searchParams} />
      <nav aria-label="Written questions" className="row">
        {written.map((w, i) => {
          const list = answers.filter((a) => a.question_id === w.question_id);
          const done = list.filter((a) => a.marks_awarded != null).length;
          return (
            <Link
              key={w.question_id}
              href={query(w.question_id)}
              className={`button${w.question_id === current.question_id ? ' primary' : ''}`}
              aria-current={w.question_id === current.question_id ? 'page' : undefined}
            >
              Q{i + 1} · {done}/{list.length}
            </Link>
          );
        })}
      </nav>
      <section className="card stack" aria-labelledby="question">
        <h2 id="question">Question ({current.marks} marks)</h2>
        <Markdown text={current.questions.stem} />
        {current.questions.question_keys?.key.model_answer && (
          <p className="notice" style={{ whiteSpace: 'pre-wrap' }}>
            <b>Model answer (guide):</b> <MathText text={current.questions.question_keys.key.model_answer} />
          </p>
        )}
      </section>
      {mine.length === 0 && <p className="empty">No student answered this question.</p>}
      {mine.map((a, i) => {
        const label = hide ? `Student ${i + 1}` : (name.get(a.test_attempts.user_id) ?? 'Unnamed');
        return (
          <section key={a.attempt_id} className="card stack" aria-labelledby={`a-${a.attempt_id}`}>
            <h3 id={`a-${a.attempt_id}`}>
              {label}{' '}
              {a.marks_awarded != null ? (
                <span className="badge good">Checked: {a.marks_awarded}</span>
              ) : (
                <span className="badge warn">Not checked</span>
              )}
            </h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{typeof a.response === 'string' ? a.response : ''}</p>
            <form action={gradeAnswer} className="inline">
              <input type="hidden" name="test_id" value={id} />
              <input type="hidden" name="attempt_id" value={a.attempt_id} />
              <input type="hidden" name="question_id" value={a.question_id} />
              {hide && <input type="hidden" name="names" value="hidden" />}
              <label>
                Marks (out of {current.marks})
                <input
                  name="marks"
                  type="number"
                  min={0}
                  max={current.marks}
                  step={0.5}
                  required
                  defaultValue={a.marks_awarded ?? ''}
                  style={{ width: 100 }}
                />
              </label>
              <label style={{ flex: 1 }}>
                Comment for the student (optional)
                <input name="comment" maxLength={2000} defaultValue={a.teacher_comment ?? ''} />
              </label>
              <button type="submit" className="primary" aria-label={`Save marks for ${label}`}>
                Save
              </button>
            </form>
          </section>
        );
      })}
    </>
  );
}
