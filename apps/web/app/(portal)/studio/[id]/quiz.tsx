'use client';

import { useState, useTransition } from 'react';
import { submitQuiz } from '../actions';
import { MathText } from '@/lib/markdown';

type Question = { id: string; stem: string; options: { id: string; text: string }[] };
type Result = NonNullable<Awaited<ReturnType<typeof submitQuiz>>>;

// Practice quiz runner. It gets no answers: the database grades the try and only then are the right answers shown.
export function Quiz({ artifactId, questions }: { artifactId: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const byId = new Map(result?.results.map((r) => [r.id, r]));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitQuiz(artifactId, answers);
          setFailed(!r);
          setResult(r);
        });
      }}
    >
      {result && (
        <p role="status" className="notice">
          Your score: {result.score} of {result.max_score}. Practice never affects your rank.
        </p>
      )}
      {failed && (
        <p role="alert" className="alert">
          Something went wrong. Please try again.
        </p>
      )}
      <ol className="stack">
        {questions.map((q) => {
          const r = byId.get(q.id);
          return (
            <li key={q.id}>
              <fieldset disabled={!!result}>
                <legend>
                  <MathText text={q.stem} />
                </legend>
                {q.options.map((o) => (
                  <label key={o.id} style={{ display: 'block' }}>
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    />{' '}
                    <MathText text={o.text} />
                    {r && o.id === r.answer && <span className="badge good"> Correct answer</span>}
                    {r && !r.correct && o.id === r.choice && <span className="badge bad"> Your answer</span>}
                  </label>
                ))}
                {r?.explanation && (
                  <p className="small muted">
                    <MathText text={r.explanation} />
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {result ? (
        <button type="button" onClick={() => (setResult(null), setAnswers({}))}>
          Try again
        </button>
      ) : (
        <button type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Check my answers'}
        </button>
      )}
    </form>
  );
}
