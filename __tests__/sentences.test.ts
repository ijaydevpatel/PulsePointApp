import { limitSentences } from '../src/domain/sentences';

const REAL_SYNOPSIS =
  'The diagnostic matrix shows that most chest discomfort in a young, lean male '
  + 'is usually linked to reflux, muscle strain, or anxiety, which are common and '
  + 'often low-severity. However, the presence of sharp, unexplained pressure must '
  + 'also raise suspicion for life-threatening events like a pulmonary embolism or '
  + 'a myocardial infarction, both demanding urgent evaluation. The allopathic plan '
  + 'covers acid suppression, pain control, anxiety relief, antiplatelet therapy, '
  + 'and rapid nitroglycerin for possible cardiac ischemia. Complementary '
  + 'homeopathic choices aim to balance the body’s energy patterns while the '
  + 'home remedies offer practical, low-risk steps such as warm compresses and '
  + 'breathing exercises. Education stresses that diet, posture, stress management, '
  + 'and avoiding immobility can prevent many episodes, but any worsening or new '
  + 'symptoms should trigger immediate medical attention. Together, these layers of '
  + 'care provide a safety net that addresses both everyday triggers and critical '
  + 'emergencies.';

const count = (s: string): number => (s.match(/[.!?](\s|$)/g) ?? []).length;

describe('limitSentences', () => {
  it('cuts the synopsis that was actually too long down to five', () => {
    const out = limitSentences(REAL_SYNOPSIS, 5);

    expect(count(out)).toBe(5);
    expect(out.startsWith('The diagnostic matrix shows')).toBe(true);
    expect(out).toContain('myocardial infarction');
    expect(out).not.toContain('Together, these layers of care');
  });

  it('never ends mid-sentence', () => {
    const out = limitSentences(REAL_SYNOPSIS, 5);
    expect(out.trim()).toMatch(/[.!?]$/);
  });

  it('leaves text that is already short enough alone', () => {
    const short = 'Congestion and cramp suggest a viral illness. Rest and fluids. See a doctor if it worsens.';
    expect(limitSentences(short, 5)).toBe(short);
  });

  it('does not split a decimal', () => {
    const t = 'Take 2.5 ml twice daily. Stop if a rash appears.';
    expect(limitSentences(t, 1)).toBe('Take 2.5 ml twice daily.');
  });

  it('does not split on an abbreviation', () => {
    const t = 'Avoid NSAIDs, e.g. ibuprofen, on an empty stomach. Paracetamol is safer.';
    expect(limitSentences(t, 1)).toBe('Avoid NSAIDs, e.g. ibuprofen, on an empty stomach.');
  });

  it('treats a run of terminators as one ending', () => {
    expect(limitSentences('Is this serious?! Probably not. Rest today.', 2))
      .toBe('Is this serious?! Probably not.');
  });

  it('keeps an unterminated tail when there is room for it', () => {
    expect(limitSentences('One thing. A second without a full stop', 5))
      .toBe('One thing. A second without a full stop');
  });

  it('returns unsplittable text whole rather than guessing', () => {
    const blob = 'no terminator anywhere in this string at all';
    expect(limitSentences(blob, 2)).toBe(blob);
  });

  it('handles empty and degenerate input', () => {
    expect(limitSentences('', 5)).toBe('');
    expect(limitSentences('   ', 5)).toBe('');
    expect(limitSentences('Something.', 0)).toBe('Something.');
  });

  it('does not break a decimal or a dotted token mid-word', () => {
    const t = 'See report_v1.2 for detail. Nothing else is needed.';
    expect(limitSentences(t, 1)).toBe('See report_v1.2 for detail.');
  });
});
