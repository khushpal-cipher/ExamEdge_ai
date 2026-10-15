'use client';

import { useState } from 'react';
import { saveQuestion } from '../tests/actions';

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
}: {
  subjects: Subject[];
  initial?: QuestionInit;
  subjectId?: string;
}) {
  const [type, setType] = useState(initial?.type ?? 'single');
  const [subject, setSubject] = useState(initial?.subject_id ?? subjectId ?? subjects[0]?.id ?? '');
  const chapters = subjects.find((s) => s.id === subject)?.chapters ?? [];
  const option = (id: string) => initial?.options.find((o) => o.id === id)?.text ?? '';
  const correct = new Set(initial?.key?.correct ?? []);
  return (
    <form action={saveQuestion} className="stack">
      {initial && <input type="hidden" name="question_id" value={initial.id} />}
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
          Chapter
          <select name="chapter_id" defaultValue={initial?.chapter_id ?? ''} key={subject}>
            <option value="">No chapter</option>
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
          Model answer (a guide for checking; never used to mark automatically)
          <textarea name="model_answer" required maxLength={5000} rows={3} defaultValue={initial?.key?.model_answer} />
        </label>
      )}
      <label>
        Explanation shown after results (optional)
        <textarea name="explanation" maxLength={5000} rows={2} defaultValue={initial?.explanation} />
      </label>
      <div>
        <button type="submit" className="primary">
          {initial ? 'Save question' : 'Add question'}
        </button>
      </div>
    </form>
  );
}
