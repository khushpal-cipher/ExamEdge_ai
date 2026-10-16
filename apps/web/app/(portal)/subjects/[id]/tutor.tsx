'use client';

import { useRef, useState } from 'react';
import type { Citation } from '@examedge/core/ai/tutor';
import { Markdown } from '@/lib/markdown';
import { rateAnswer, reportAnswer } from './actions';

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  answer_labels: { label: 'notes' | 'library' | 'general'; citations: number[] }[];
  feedback?: 'up' | 'down' | null;
};

const BLOCKED: Record<string, string> = {
  quota: "You've used today's AI limit. It resets tomorrow.",
  budget: "Your institute's AI budget for this month is used up. Please tell your institute admin.",
  ai_disabled: 'The AI tutor is switched off right now. Please try again later.',
};
const FAILED = 'Something went wrong. Please try again.';

// One answer: each paragraph shows where it came from. Labels come from citations (ADR-026), never from the model.
function Answer({ m }: { m: ChatMessage }) {
  const paragraphs = m.content.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="stack">
      {paragraphs.map((text, i) => {
        const label = m.answer_labels[i];
        const cited = (label?.citations ?? []).map((n) => m.citations[n]).filter((c) => c !== undefined);
        return (
          <div key={i} className="answer-part">
            <Markdown text={text} />
            <p className="small">
              {label && label.label !== 'general' && cited.length ? (
                cited.map((c, j) =>
                  c.source_kind === 'library' ? (
                    <a
                      key={j}
                      className="badge warn"
                      href={`/library/${c.library_item_id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      ExamEdge library: {c.title}
                    </a>
                  ) : (
                    <a
                      key={j}
                      className="badge good"
                      href={`/documents/${c.document_id}/file#page=${c.page_start}`}
                      target="_blank"
                      rel="noopener"
                    >
                      From your institute&apos;s notes: {c.title}, p.{c.page_start}
                    </a>
                  ),
                )
              ) : (
                <span className="badge">General explanation</span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Actions({ m, onRated }: { m: ChatMessage; onRated: (f: ChatMessage['feedback']) => void }) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reason, setReason] = useState('');
  if (!m.id) return null;
  const rate = async (f: 'up' | 'down') => {
    const next = m.feedback === f ? null : f;
    if (await rateAnswer(m.id!, next)) onRated(next);
  };
  return (
    <div className="row small">
      <button
        type="button"
        className="link"
        aria-label="Helpful"
        aria-pressed={m.feedback === 'up'}
        onClick={() => rate('up')}
      >
        👍
      </button>
      <button
        type="button"
        className="link"
        aria-label="Not helpful"
        aria-pressed={m.feedback === 'down'}
        onClick={() => rate('down')}
      >
        👎
      </button>
      {reported ? (
        <span className="muted">Reported. Your teacher will review it.</span>
      ) : reporting ? (
        <form
          className="inline"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await reportAnswer(m.id!, reason)) setReported(true);
          }}
        >
          <label>
            What looks wrong? (optional)
            <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="submit">Send report</button>
          <button type="button" className="link" onClick={() => setReporting(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="link" onClick={() => setReporting(true)}>
          Report answer
        </button>
      )}
    </div>
  );
}

export function Tutor(props: {
  subjectId: string;
  subjectName: string;
  conversationId: string | null;
  messages: ChatMessage[];
}) {
  const [conversationId, setConversationId] = useState(props.conversationId);
  const [messages, setMessages] = useState(props.messages);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function ask(premium: boolean) {
    const question = draft.trim();
    if (!question || streaming !== null) return;
    setError('');
    setDraft('');
    setMessages((m) => [...m, { role: 'user', content: question, citations: [], answer_labels: [] }]);
    setStreaming('');
    let failed: string | null = FAILED;
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subjectId: props.subjectId,
          conversationId: conversationId ?? undefined,
          question,
          premium,
        }),
      });
      if (res.ok && res.body) {
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          for (let n = buf.indexOf('\n'); n >= 0; n = buf.indexOf('\n')) {
            const line = JSON.parse(buf.slice(0, n));
            buf = buf.slice(n + 1);
            if (line.t === 'delta') setStreaming((s) => (s ?? '') + line.text);
            else if (line.t === 'error') failed = BLOCKED[line.code] ?? FAILED;
            else if (line.t === 'done') {
              failed = null;
              setConversationId(line.conversationId);
              setMessages((m) => [...m, { ...line.message, role: 'assistant', feedback: null }]);
            }
          }
        }
      }
    } catch {
      // network error: shown below
    }
    setStreaming(null);
    if (failed) {
      setError(failed);
      setMessages((m) => m.slice(0, -1)); // the question was not saved
      setDraft(question);
    }
    input.current?.focus();
  }

  const busy = streaming !== null;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>AI tutor · {props.subjectName}</h2>
        {messages.length > 0 && (
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => {
              setConversationId(null);
              setMessages([]);
              setError('');
            }}
          >
            New chat
          </button>
        )}
      </div>
      <div className="stack chat" role="log" aria-label="Chat" aria-busy={busy}>
        {messages.length === 0 && !busy && (
          <p className="empty reading">
            Ask a doubt about {props.subjectName}. Answers come from your institute&apos;s notes (with page links) and
            the reviewed ExamEdge library; anything else is marked &quot;General explanation&quot;.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="question">
              {m.content}
            </p>
          ) : (
            <div key={m.id ?? i} className="card stack">
              <Answer m={m} />
              <Actions
                m={m}
                onRated={(feedback) => setMessages((all) => all.map((x) => (x === m ? { ...x, feedback } : x)))}
              />
            </div>
          ),
        )}
        {busy && (
          <div className="card">{streaming ? <Markdown text={streaming} /> : <p className="muted">Thinking…</p>}</div>
        )}
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form
        className="stack"
        aria-label="Ask a doubt"
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          ask(submitter?.value === 'premium');
        }}
      >
        <label className="sr-only" htmlFor="doubt">
          Your doubt
        </label>
        <input
          id="doubt"
          ref={input}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask a doubt about ${props.subjectName}…`}
        />
        <div className="row">
          <button type="submit" className="primary" value="normal" disabled={busy || !draft.trim()}>
            Ask
          </button>
          <button type="submit" value="premium" disabled={busy || !draft.trim()}>
            Solve step by step
          </button>
        </div>
      </form>
    </>
  );
}
