const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'approx', 'vs', 'etc', 'dr', 'mr', 'mrs', 'ms', 'st',
  'mg', 'ml', 'mcg', 'kg', 'hr', 'hrs', 'no',
]);

const TERMINATORS = '.!?';

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

export function limitSentences(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed || max <= 0) return trimmed;

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] ?? '';
    if (!TERMINATORS.includes(ch)) continue;

    if (ch === '.' && isDigit(trimmed[i - 1]) && isDigit(trimmed[i + 1])) continue;

    let end = i;
    while (end + 1 < trimmed.length && TERMINATORS.includes(trimmed[end + 1] ?? '')) end += 1;

    const next = trimmed[end + 1];
    if (next !== undefined && !/\s/.test(next)) { i = end; continue; }

    const lastWord = trimmed.slice(start, i).trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    if (ABBREVIATIONS.has(lastWord)) { i = end; continue; }

    sentences.push(trimmed.slice(start, end + 1).trim());
    start = end + 1;
    i = end;

    if (sentences.length >= max) break;
  }

  if (sentences.length === 0) return trimmed;

  if (sentences.length < max) {
    const tail = trimmed.slice(start).trim();
    if (tail) sentences.push(tail);
  }

  return sentences.join(' ');
}
