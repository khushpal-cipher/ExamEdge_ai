// Studio helpers shared by the artifact page and its Server Functions.
export const STUDIO_KIND: Record<string, string> = {
  summary: 'Summary',
  flashcards: 'Flashcards',
  mind_map: 'Mind map',
  quiz: 'Practice quiz',
};

const IS_ID = /(^|\.)id$/;

// The editable text of an artifact: every string leaf except ids, as [path, value] ("sections.0.heading").
export function textFields(content: unknown, path = ''): [string, string][] {
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  if (typeof content === 'string') return IS_ID.test(path) ? [] : [[path, content]];
  if (Array.isArray(content)) return content.flatMap((v, i) => textFields(v, at(i)));
  if (content && typeof content === 'object') return Object.entries(content).flatMap(([k, v]) => textFields(v, at(k)));
  return [];
}

// A copy of the content with some string leaves replaced; paths that are not string leaves are ignored, so the
// shape (and every citation) stays as generated.
export function withTexts(content: unknown, values: Map<string, string>, path = ''): unknown {
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  if (typeof content === 'string') return IS_ID.test(path) ? content : (values.get(path) ?? content);
  if (Array.isArray(content)) return content.map((v, i) => withTexts(v, values, at(i)));
  if (content && typeof content === 'object')
    return Object.fromEntries(Object.entries(content).map(([k, v]) => [k, withTexts(v, values, at(k))]));
  return content;
}

// "questions.0.options.2.text" → "Questions 1 · options 3 · text"
export const fieldLabel = (path: string) =>
  path
    .split('.')
    .map((p) => (/^\d+$/.test(p) ? String(+p + 1) : p))
    .join(' ')
    .replace(/ (?=\D)/g, ' · ')
    .replace(/^./, (c) => c.toUpperCase());
