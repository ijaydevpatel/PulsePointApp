import { ChatTurn } from './remote';

/**
 * The chat backend does not carry a conversation. Observed on a device on
 * 21 Oct 2026: it greeted the user again on every turn and re-asked a question
 * it had already been answered, because each message arrived with no history.
 *
 * The app cannot change the API, but /api/chat/message takes free text, so the
 * client can supply the thread inside the message it already sends.
 *
 * The session id is still sent alongside. It is not enough on its own: the
 * server returns one and then ignores it, which is why the first attempt at
 * this fix, which only added context when no id was present, changed nothing.
 */

const MAX_TURNS = 6;
const MAX_CHARS = 1200;
const PER_TURN_CHARS = 300;

function clip(text: string, limit: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= limit ? t : `${t.slice(0, limit - 1)}…`;
}

export function withConversationContext(
  turns: readonly ChatTurn[],
  message: string,
): string {
  const current = message.trim();
  if (!current) return current;

  const prior = turns.filter((t) => t.text.trim().length > 0);
  if (prior.length === 0) return current;

  const recent = prior.slice(-MAX_TURNS);

  const lines: string[] = [];
  let budget = MAX_CHARS;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const t = recent[i];
    if (!t) continue;
    const line = `${t.role === 'user' ? 'Patient' : 'Assistant'}: ${clip(t.text, PER_TURN_CHARS)}`;
    if (line.length > budget) break;
    budget -= line.length;
    lines.unshift(line);
  }

  if (lines.length === 0) return current;

  return [
    'Conversation so far, for context. Do not greet again and do not repeat a question already answered.',
    ...lines,
    `Patient now says: ${current}`,
  ].join('\n');
}
