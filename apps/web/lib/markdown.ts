// Safe Markdown for AI answers and notes (TH-09, TH-19, ADR-026): builds React elements only, so raw HTML is shown as
// text. Images become their alt text and links their label (no remote fetches, no exfiltration through URLs).
// Supported: paragraphs, - / 1. lists, **bold**, *italic*, `code`, ``` blocks, # headings (as bold lines),
// $…$ and $$…$$ formulas typeset by KaTeX (ADR-053). trust: false blocks \href, \url, \includegraphics and raw HTML.
import katex from 'katex';
import { createElement as h, type ReactNode } from 'react';

const INLINE =
  /(\$\$[^$\n]+\$\$|\*\*[^*\n]+\*\*|`[^`\n]+`|\$[^$\n]+\$|!\[[^\]\n]*\]\([^)\n]*\)|\[[^\]\n]+\]\([^)\n]*\)|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/;

function inline(text: string, key: string): ReactNode[] {
  // With one capture group, split() puts the matches at odd indexes.
  return text.split(INLINE).map((t, i) => {
    if (i % 2 === 0) return t;
    const k = `${key}.${i}`;
    if (t.startsWith('**')) return h('strong', { key: k }, inline(t.slice(2, -2), k));
    if (t.startsWith('`')) return h('code', { key: k }, t.slice(1, -1));
    if (t.startsWith('$')) return math(t, k);
    if (t.startsWith('![')) return t.slice(2, t.indexOf(']('));
    if (t.startsWith('[')) return h('span', { key: k }, inline(t.slice(1, t.indexOf('](')), k));
    return h('em', { key: k }, inline(t.slice(1, -1), k));
  });
}

function math(t: string, key: string) {
  const display = t.startsWith('$$');
  const __html = katex.renderToString(t.slice(display ? 2 : 1, display ? -2 : -1), {
    displayMode: display,
    throwOnError: false,
    trust: false,
    maxSize: 10,
    maxExpand: 100,
  });
  return h('span', { key, className: 'math', dangerouslySetInnerHTML: { __html } });
}

// One line of text with inline Markdown and formulas, for places that only accept phrasing content (options, legends).
export function MathText({ text }: { text: string }) {
  return h('span', { className: 'md-inline' }, inline(text, 'i'));
}

// True when any $…$ formula in these texts cannot be drawn (it would show as red text), so an AI draft with one is
// flagged and cannot be approved until a teacher fixes it (ADR-054).
export function brokenMath(...texts: (string | null | undefined)[]) {
  return texts.some((text) =>
    (text ?? '').split(INLINE).some((t, i) => {
      if (i % 2 === 0 || !t.startsWith('$')) return false;
      const display = t.startsWith('$$');
      try {
        katex.renderToString(t.slice(display ? 2 : 1, display ? -2 : -1), { throwOnError: true, trust: false });
        return false;
      } catch {
        return true;
      }
    }),
  );
}

// The texts of a question that may hold formulas.
export const questionTexts = (q: {
  stem: string;
  options?: { text: string }[] | null;
  explanation?: string | null;
  model_answer?: string | null;
}) => [q.stem, q.explanation, q.model_answer, ...(q.options ?? []).map((o) => o.text)];

// Shortens text for a one-line label without cutting a $…$ formula in half.
export function clip(text: string, n = 80) {
  if (text.length <= n) return text;
  const cut = text.slice(0, n);
  return `${(cut.split('$').length % 2 ? cut : cut.slice(0, cut.lastIndexOf('$'))).trimEnd()}…`;
}

const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING = /^\s*#{1,6}\s+/;

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    const k = String(i);
    if (!line.trim()) {
      i++;
    } else if (line.trimStart().startsWith('```')) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i]!.trimStart().startsWith('```'); i++) body.push(lines[i]!);
      i++;
      out.push(h('pre', { key: k }, h('code', null, body.join('\n'))));
    } else if (ITEM.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: ReactNode[] = [];
      for (; i < lines.length && ITEM.test(lines[i]!); i++)
        items.push(h('li', { key: i }, inline(lines[i]!.replace(ITEM, ''), `${i}`)));
      out.push(h(ordered ? 'ol' : 'ul', { key: k }, items));
    } else if (HEADING.test(line)) {
      out.push(h('p', { key: k }, h('strong', null, inline(line.replace(HEADING, ''), k))));
      i++;
    } else {
      const para: string[] = [];
      const plain = (l: string) => l.trim() && !ITEM.test(l) && !HEADING.test(l) && !l.trimStart().startsWith('```');
      for (; i < lines.length && plain(lines[i]!); i++) para.push(lines[i]!.trim());
      out.push(h('p', { key: k }, inline(para.join(' '), k)));
    }
  }
  return h('div', { className: 'md' }, out);
}
