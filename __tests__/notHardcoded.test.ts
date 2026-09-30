/**
 * The score and the confidence are computed, not chosen.
 *
 * This project has already shipped one fake number: confidence was
 * `symptoms.length >= 3 ? 0.62 : 0.45`, so every one- and two-symptom episode
 * read 45% whatever was reported. It looked like a measurement and carried no
 * information, and it survived until someone noticed the same figure twice.
 *
 * A test that asserts one known input gives one known output would not have
 * caught that - the constant passes it. These assert that the outputs *move*,
 * and move in the direction the inputs push them.
 */
import { RuleClassifier } from '../src/data/ruleClassifier';
import { SymptomEpisode } from '../src/domain/entities';
import { bandForSeverity } from '../src/domain/assessSymptoms';

const classifier = new RuleClassifier();

const episode = (
  symptoms: { code: string; label: string; severity: number }[],
  durationHours = 12,
): SymptomEpisode => ({
  id: 'e', capturedAt: new Date().toISOString(),
  ageBand: 'ADULT', durationHours, symptoms,
});

const chest = (severity: number) =>
  episode([{ code: 'chest_pain', label: 'Chest pain', severity }]);

describe('severity', () => {
  it('rises with how bad the person says it is', async () => {
    const mild = (await classifier.classify(chest(2))).severity;
    const middling = (await classifier.classify(chest(5))).severity;
    const severe = (await classifier.classify(chest(9))).severity;

    expect(mild).toBeLessThan(middling);
    expect(middling).toBeLessThan(severe);
  });

  it('rises as more is reported', async () => {
    const one = (await classifier.classify(chest(5))).severity;
    const three = (await classifier.classify(episode([
      { code: 'chest_pain', label: 'Chest pain', severity: 5 },
      { code: 'breathlessness', label: 'Breathlessness', severity: 5 },
      { code: 'dizziness', label: 'Dizziness', severity: 5 },
    ]))).severity;

    expect(three).toBeGreaterThan(one);
  });

  it('gives different symptoms different weight', async () => {
    // If every symptom scored the same, the table would be decoration.
    const a = (await classifier.classify(episode([
      { code: 'chest_pain', label: 'Chest pain', severity: 6 },
    ]))).severity;
    const b = (await classifier.classify(episode([
      { code: 'sore_throat', label: 'Sore throat', severity: 6 },
    ]))).severity;

    expect(a).not.toBe(b);
  });
});

describe('confidence', () => {
  it('is not one constant for short episodes', async () => {
    /*
     * The exact shape of the bug that shipped. Two different single-symptom
     * episodes must not read the same.
     */
    const vague = (await classifier.classify(episode([
      { code: 'fatigue', label: 'Fatigue', severity: 5 },
    ]))).confidence;
    const specific = (await classifier.classify(chest(5))).confidence;

    expect(vague).not.toBe(specific);
  });

  it('rises as more symptoms are given', async () => {
    const one = (await classifier.classify(chest(6))).confidence;
    const two = (await classifier.classify(episode([
      { code: 'chest_pain', label: 'Chest pain', severity: 6 },
      { code: 'breathlessness', label: 'Breathlessness', severity: 6 },
    ]))).confidence;

    expect(two).toBeGreaterThan(one);
  });

  it('never reads 0 or 1', async () => {
    /*
     * A floor because the rules are fixed and inspectable, so even a weak
     * reading beats a guess. A ceiling because eighteen hand-written weights
     * and a threshold table cannot justify certainty.
     */
    for (const sev of [1, 3, 5, 7, 10]) {
      const c = (await classifier.classify(chest(sev))).confidence;
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(0.95);
    }
  });
});

describe('the band follows the score', () => {
  it('crosses a threshold as severity climbs', async () => {
    /*
     * The bands are thresholds over the score, so if the score moves the band
     * has to move with it somewhere. A classifier that returned one band for
     * everything would make the threshold table decoration.
     */
    const scores = await Promise.all(
      [1, 5, 9].map(async (s) => (await classifier.classify(chest(s))).severity),
    );

    // bandForSeverity, not a reimplementation of it. BAND_THRESHOLDS is
    // ordered highest-first, so a hand-rolled lookup that scans the other way
    // silently returns the mildest matching band - which is how a test can
    // pass while describing the opposite of what the app does.
    expect(new Set(scores.map(bandForSeverity)).size).toBeGreaterThan(1);
  });
});
