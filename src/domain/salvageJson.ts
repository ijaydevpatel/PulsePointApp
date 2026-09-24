/**
 * Recovering a usable object from model JSON the server could not parse.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The report route asks Gemini for a JSON object and caps the reply at 2048
 * output tokens. A short document fits. A full medical record does not: the
 * extraction pass produces a lot of text, the synthesis pass writes a
 * correspondingly long object, and the cap cuts it off - usually part-way
 * through a string value. The server's JSON.parse then fails and it answers
 * 500 "Intelligence response could not be parsed".
 *
 * That is why a small PNG reads fine and a multi-page PDF does not, on either
 * client. Nothing about the request is wrong and the model did the work; the
 * reply is simply missing its closing punctuation.
 *
 * The server hands the text back in `raw` on exactly that error, so the answer
 * is recoverable here without changing anything server-side.
 *
 * ── What it will and will not do ─────────────────────────────────────────────
 *
 * It repairs structure, never content. Unterminated strings are closed, open
 * brackets are closed, a trailing comma is dropped - all of which restore
 * syntax the model had every intention of writing. It does not invent field
 * values, and a field cut off mid-sentence stays cut off rather than being
 * completed, because guessing the rest of a clinical sentence is the one thing
 * this must never do.
 *
 * If the structure cannot be repaired it falls back to lifting individual
 * fields out by name, which survives damage anywhere else in the object.
 */

/** Strips code fences, reasoning tags, and anything outside the object. */
export function isolateObject(raw: string): string {
  let text = raw.trim();

  // <think>...</think> from reasoning models, closed or left open.
  text = text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');
  // ```json fences.
  text = text.replace(/```json/gi, '').replace(/```/g, '');

  const start = text.indexOf('{');
  if (start === -1) return text.trim();

  /*
   * To the last closing brace when there is one, otherwise to the end - a
   * truncated reply has no closing brace at all, and cutting at the last one
   * present would discard the very fields that did arrive.
   */
  const end = text.lastIndexOf('}');
  return (end > start ? text.slice(start, end + 1) : text.slice(start)).trim();
}

/**
 * Closes whatever the truncation left open.
 *
 * Walks the text tracking string state and bracket depth, so a brace inside a
 * quoted value is not mistaken for structure.
 */
export function repairTruncation(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }

    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let repaired = text;

  // A value cut mid-sentence: close the quote and leave the words alone.
  if (inString) repaired += '"';

  // A dangling comma or colon, now that nothing follows it.
  repaired = repaired.replace(/,\s*$/, '').replace(/:\s*$/, ': null');

  while (stack.length > 0) repaired += stack.pop() === '[' ? ']' : '}';

  return repaired;
}

/** Last resort: lift string and string-array fields out by name. */
export function liftFields(text: string, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    const str = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i').exec(text);
    if (str && str[1] !== undefined) {
      out[key] = str[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      continue;
    }

    const arr = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`, 'i').exec(text);
    if (arr && arr[1] !== undefined) {
      out[key] = arr[1]
        .split(',')
        .map((v) => v.trim().replace(/^"|"$/g, '').trim())
        .filter((v) => v.length > 0);
      continue;
    }

    /*
     * An unterminated final string: everything after the colon, to the end.
     * This is the field the truncation landed in, and it is usually the
     * longest and most useful one in the object.
     */
    const open = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)$`, 'i').exec(text);
    if (open && open[1] !== undefined && open[1].trim().length > 0) {
      out[key] = open[1].replace(/\\n/g, '\n').trim();
    }
  }

  return out;
}

/**
 * Parse `raw` as best it can, in three escalating attempts.
 *
 * Returns null only when there is nothing recognisable at all, so the caller
 * can still report an honest failure rather than an empty success.
 */
export function salvageJson(
  raw: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const isolated = isolateObject(raw);
  if (!isolated.includes('{')) return null;

  // 1. It may simply have had a fence or a preamble around it.
  try {
    const parsed = JSON.parse(isolated);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch { /* fall through */ }

  // 2. Structurally incomplete: close what the cap left open.
  try {
    const parsed = JSON.parse(repairTruncation(isolated));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch { /* fall through */ }

  // 3. Damaged somewhere unrepairable: take the fields one at a time.
  const lifted = liftFields(isolated, keys);
  return Object.keys(lifted).length > 0 ? lifted : null;
}
