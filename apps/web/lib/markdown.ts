// Safe Markdown for AI answers and notes (TH-09, TH-19, ADR-026): builds React elements only, so raw HTML is shown as
// text. Images become their alt text and links their label (no remote fetches, no exfiltration through URLs).
// Supported: paragraphs, - / 1. lists, **bold**, *italic*, `code`, ``` blocks, # headings (as bold lines).
// shortcut: $…$ formulas are shown as code, not typeset; add KaTeX (trust: false) when formula rendering is needed.
import { createElement as h, type ReactNode } from 'react';

const INLINE =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\$[^$\n]+\$|!\[[^\]\n]*\]\([^)\n]*\)|\[[^\]\n]+\]\([^)\n]*\)|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/;

function inline(text: string, key: string): ReactNode[] {
  // With one capture group, split() puts the matches at odd indexes.
  return text.split(INLINE).map((t, i) => {
    if (i % 2 === 0) return t;
    const k = `${key}.${i}`;
    if (t.startsWith('**')) return h('strong', { key: k }, inline(t.slice(2, -2), k));
    if (t.startsWith('`')) return h('code', { key: k }, t.slice(1, -1));
    if (t.startsWith('$')) return h('code', { key: k, className: 'math' }, t.slice(1, -1));
    if (t.startsWith('![')) return t.slice(2, t.indexOf(']('));
    if (t.startsWith('[')) return h('span', { key: k }, inline(t.slice(1, t.indexOf('](')), k));
    return h('em', { key: k }, inline(t.slice(1, -1), k));
  });
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
