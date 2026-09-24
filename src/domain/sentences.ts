/**
 * Cutting written model output down to a sentence count.
 *
 * ── Why the app does this at all ─────────────────────────────────────────────
 *
 * The synopsis is supposed to be four or five sentences. The server prompt
 * asks for that in two places, and the model still returns seven or eight -
 * which is what prompts do: they are a request, not a constraint. Length is a
 * property of the screen, so the screen enforces it.
 *
 * ── Why this is safe to do to clinical text ──────────────────────────────────
 *
 * Trimming prose that might end with "seek help if this worsens" would be
 * indefensible if that sentence were the only thing carrying the warning. It
 * is not. Escalation on the result screen is structural: the band, the red
 * flags and the Call 111 button are decided on the device by the rule engine,
 * they sit above the synopsis, and none of them read this string. The synopsis
 * explains; it does not warn. Shortening an explanation removes detail, not
 * the warning.
 *
 * ── Why it cuts on sentence boundaries only ──────────────────────────────────
 *
 * A character budget would end mid-clause, and a summary that stops in the
 * middle of a sentence about a heart attack reads as a broken app at the exact
 * moment the reader needs to trust it. This returns whole sentences or the
 * original text, never a fragment.
 */

/**
 * Words whose trailing full stop does not end a sentence.
 *
 * Short on purpose. A long list guesses at text nobody has seen; these are the
 * ones that actually turn up in medical prose.
 */
const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'approx', 'vs', 'etc', 'dr', 'mr', 'mrs', 'ms', 'st',
  'mg', 'ml', 'mcg', 'kg', 'hr', 'hrs', 'no',
]);

const TERMINATORS = '.!?';

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

/**
 * The first `max` sentences of `text`, or all of it if there are fewer.
 *
 * Returns the input unchanged when no sentence boundary can be found, because
 * a single unterminated block is more likely to be prose the splitter does not
 * understand than one enormous sentence - and showing too much beats showing
 * an arbitrary slice.
 */
export function limitSentences(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed || max <= 0) return trimmed;

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] ?? '';
    if (!TERMINATORS.includes(ch)) continue;

    // A full stop between two digits is a decimal point: "2.5 litres".
    if (ch === '.' && isDigit(trimmed[i - 1]) && isDigit(trimmed[i + 1])) continue;

    // Runs like "?!" or "..." end once, not three times.
    let end = i;
    while (end + 1 < trimmed.length && TERMINATORS.includes(trimmed[end + 1] ?? '')) end += 1;

    // Mid-word, as in a URL or a file name. Not a boundary.
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

  // An unterminated tail is still a sentence if there is room for it - the
  // model sometimes stops without a full stop.
  if (sentences.length < max) {
    const tail = trimmed.slice(start).trim();
    if (tail) sentences.push(tail);
  }

  return sentences.join(' ');
}
