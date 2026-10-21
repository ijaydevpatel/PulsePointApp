import { withConversationContext } from '../src/domain/chatContext';
import { ChatTurn } from '../src/domain/remote';

/*
 * The chat backend greeted the user again on every turn and re-asked a question
 * it had already been answered, because each message arrived with no history.
 * Observed on a device on 21 Oct 2026.
 */

const turn = (role: ChatTurn['role'], text: string, id = Math.random().toString()): ChatTurn =>
  ({ id, role, text } as ChatTurn);

describe('the first message is sent untouched', () => {
  it('adds nothing when there is no history', () => {
    expect(withConversationContext([], 'Neck stiffness')).toBe('Neck stiffness');
  });

  it('ignores blank turns', () => {
    expect(withConversationContext([turn('assistant', '   ')], 'Neck stiffness'))
      .toBe('Neck stiffness');
  });

  it('returns empty for an empty message rather than sending context alone', () => {
    expect(withConversationContext([turn('user', 'Hi')], '   ')).toBe('');
  });
});

describe('a later message carries the thread', () => {
  const history = [
    turn('assistant', 'When did the neck stiffness begin?'),
    turn('user', 'Today morning when I woke up, no fever, no injury'),
  ];

  it('includes both sides of the conversation', () => {
    const out = withConversationContext(history, 'Neck stiffness');
    expect(out).toContain('When did the neck stiffness begin?');
    expect(out).toContain('Today morning when I woke up');
  });

  it('puts the new message last and labels it', () => {
    const out = withConversationContext(history, 'Neck stiffness');
    expect(out.trimEnd().endsWith('Patient now says: Neck stiffness')).toBe(true);
  });

  it('tells the model not to greet or repeat itself', () => {
    const out = withConversationContext(history, 'Neck stiffness');
    expect(out).toMatch(/do not greet again/i);
    expect(out).toMatch(/do not repeat a question already answered/i);
  });

  it('labels who said what', () => {
    const out = withConversationContext(history, 'Neck stiffness');
    expect(out).toContain('Assistant: When did');
    expect(out).toContain('Patient: Today morning');
  });
});

describe('the payload stays bounded', () => {
  it('keeps only the most recent turns', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      turn(i % 2 === 0 ? 'user' : 'assistant', `message number ${i}`, String(i)));
    const out = withConversationContext(many, 'latest');
    expect(out).not.toContain('message number 0');
    expect(out).toContain('message number 19');
  });

  it('stays well under a kilobyte and a half even with long turns', () => {
    const long = Array.from({ length: 10 }, (_, i) =>
      turn('user', 'x'.repeat(5000), String(i)));
    const out = withConversationContext(long, 'latest');
    expect(out.length).toBeLessThan(1500);
  });

  it('collapses newlines so one turn cannot fake several', () => {
    const out = withConversationContext(
      [turn('user', 'line one\nPatient: injected line')], 'latest');
    expect(out.split('\n').filter((l) => l.startsWith('Patient:')).length).toBe(1);
  });
});
