'use client';

import { useState } from 'react';
import { addTypedQuestion, saveQuestion } from '../tests/actions';

type Subject = { id: string; name: string; chapters: { id: string; name: string }[] };
export type QuestionInit = {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  type: string;
  stem: string;
  options: { id: string; text: string }[];
  explanation: string;
  difficulty: string;
  key: { correct?: string[]; value?: number; tolerance_abs?: number; model_answer?: string } | null;
};

const TYPE_LABELS: [string, string][] = [
  ['single', 'MCQ — one correct'],
  ['multi', 'MCQ — more than one correct'],
  ['numerical', 'Numerical answer'],
  ['written', 'Written (theory) answer'],
];
const LETTERS = ['a', 'b', 'c', 'd'];

export function QuestionForm({
  subjects,
  initial,
  subjectId,
  back,
  testId,
}: {
  subjects: Subject[];
  initial?: QuestionInit;
  subjectId?: string;
  back?: string;
  testId?: string; // "Type a question" on a draft test: adds it to the test too (ADR-042)
}) {
  const [type, setType] = useState(initial?.type ?? 'single');
  const [subject, setSubject] = useState(initial?.subject_id ?? subjectId ?? subjects[0]?.id ?? '');
  const chapters = subjects.find((s) => s.id === subject)?.chapters ?? [];
  const option = (id: string) => initial?.options.find((o) => o.id === id)?.text ?? '';
  const correct = new Set(initial?.key?.correct ?? []);
  return (
    <form
      action={testId ? addTypedQuestion : saveQuestion}
      className="stack"
      aria-label={testId ? 'Type a question' : undefined}
    >
      {testId && <input type="hidden" name="test_id" value={testId} />}
      {initial && <input type="hidden" name="question_id" value={initial.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <div className="inline">
        <label>
          Subject
          <select name="subject_id" value={subject} onChange={(e) => setSubject(e.target.value)} required>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Topic
          <select name="chapter_id" defaultValue={initial?.chapter_id ?? ''} key={subject} required={!!testId}>
            {!testId && <option value="">No topic</option>}
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_LABELS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select name="difficulty" defaultValue={initial?.difficulty ?? 'medium'}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
      <label>
        Question
        <textarea name="stem" required maxLength={5000} rows={3} defaultValue={initial?.stem} />
      </label>

      {(type === 'single' || type === 'multi') && (
        <fieldset className="stack">
          <legend>Options — tick the correct {type === 'single' ? 'one' : 'ones'}</legend>
          {LETTERS.map((l) => (
            <div key={l} className="row">
              <input
                type={type === 'single' ? 'radio' : 'checkbox'}
                name="correct"
                value={l}
                defaultChecked={correct.has(l)}
                required={type === 'single'}
                aria-label={`Option ${l.toUpperCase()} is correct`}
              />
              <label className="row" style={{ flex: 1 }}>
                <span aria-hidden="true">{l.toUpperCase()}</span>
                <input
                  name={`option_${l}`}
                  maxLength={1000}
                  defaultValue={option(l)}
                  required={l === 'a' || l === 'b'}
                  aria-label={`Option ${l.toUpperCase()}`}
                  style={{ flex: 1 }}
                />
              </label>
            </div>
          ))}
          {type === 'multi' && (
            <p className="small muted">
              Marked like JEE Advanced: all correct options = full marks; only correct ones but not all = a quarter of
              the marks for each; any wrong option = the negative marks.
            </p>
          )}
        </fieldset>
      )}
      {type === 'numerical' && (
        <div className="inline">
          <label>
            Correct answer
            <input name="value" type="number" step="any" required defaultValue={initial?.key?.value} />
          </label>
          <label>
            Allowed error (±)
            <input name="tolerance" type="number" step="any" min="0" defaultValue={initial?.key?.tolerance_abs ?? 0} />
          </label>
        </div>
      )}
      {type === 'written' && (
        <label>
          Model answer (optional: a guide for checking; never used to mark automatically)
          <textarea name="model_answer" maxLength={5000} rows={3} defaultValue={initial?.key?.model_answer} />
        </label>
      )}
      <label>
        Explanation shown after results (optional)
        <textarea name="explanation" maxLength={5000} rows={2} defaultValue={initial?.explanation} />
      </label>
      {testId && (
        <div className="inline">
          <label>
            Marks for a correct answer
            <input name="marks" type="number" min={0.5} step={0.5} defaultValue={4} required style={{ width: 80 }} />
          </label>
          {/* theory answers are marked by the teacher, so negative marking applies to the auto-marked types only */}
          {type !== 'written' && (
            <label>
              Negative marks for a wrong answer
              <input name="negative_marks" type="number" step={0.25} defaultValue={0} style={{ width: 80 }} />
            </label>
          )}
        </div>
      )}
      <div>
        <button type="submit" className="primary">
          {initial ? 'Save question' : 'Add question'}
        </button>
      </div>
    </form>
  );
}
