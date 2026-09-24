/**
 * Phase 1 classifier: deterministic, explainable, no ML.
 *
 * Scoring uses a saturating (noisy-OR) aggregate rather than a linear sum.
 * A linear sum is wrong here for two reasons: it is unbounded, so it cannot be
 * mapped onto the 0..100 band thresholds without arbitrary rescaling; and it
 * lets many trivial symptoms out-vote one serious symptom. Noisy-OR keeps the
 * score in [0,1) by construction and makes each additional symptom contribute
 * progressively less, which matches how triage severity actually behaves.
 *
 * Replaced in Phase 4 by TFLiteClassifier behind the same Classifier interface.
 */
import { SymptomEpisode } from '../domain/entities';
import { BAND_THRESHOLDS } from '../domain/assessSymptoms';
import { Classifier, Classification } from '../domain/ports';

/** Clinical weight, 0..10 - how much this symptom moves triage urgency. */
const WEIGHT: Record<string, number> = {
  facial_droop: 10, arm_weakness: 10, speech_difficulty: 10,
  chest_pain: 9, breathlessness: 9, rash_non_blanching: 9,
  confusion: 8, neck_stiffness: 7, radiating_pain: 7,
  fever: 5, photophobia: 5, vomiting: 4, headache: 3,
  diarrhoea: 3, cough: 2, sore_throat: 2, fatigue: 2, runny_nose: 1,
};
const DEFAULT_WEIGHT = 3;

export class RuleClassifier implements Classifier {
  readonly id = 'rules-v1';

  async classify(episode: SymptomEpisode): Promise<Classification> {
    const rationale: string[] = [];

    // Noisy-OR: combined = 1 - Π(1 - riskᵢ)
    let survive = 1;
    for (const s of episode.symptoms) {
      const w = WEIGHT[s.code] ?? DEFAULT_WEIGHT;
      const sev = Math.max(0, Math.min(10, s.severity));
      const risk = Math.min(0.93, (w / 10) * (sev / 10));
      survive *= 1 - risk;
      if (risk >= 0.3) rationale.push(`${s.label} at ${sev}/10`);
    }
    let score = 1 - survive;

    // Modifiers are additive on the remaining headroom, so they can nudge a
    // borderline case up a band without ever saturating it on their own.
    const bump = (amount: number, why: string) => {
      score += (1 - score) * amount;
      rationale.push(why);
    };
    if (episode.durationHours >= 168) bump(0.18, 'Symptoms persisting over a week');
    else if (episode.durationHours >= 72) bump(0.10, 'Symptoms persisting beyond three days');

    if (episode.ageBand === 'OLDER_ADULT') bump(0.15, 'Age 65 or over');
    else if (episode.ageBand === 'CHILD') bump(0.10, 'Under 12');

    const severity = Math.round(Math.max(0, Math.min(1, score)) * 100);

    return { severity, confidence: confidenceFor(episode, severity), rationale };
  }
}

/* ────────────────────────────── confidence ─────────────────────────────── */

/**
 * How much this engine should be trusted about this particular episode.
 *
 * It used to be `symptoms.length >= 3 ? 0.62 : 0.45`, which is not a
 * confidence - it is two constants wearing one. Every one- or two-symptom
 * episode read 45%, whatever was reported, and the figure carried no
 * information at all while looking as though it did. That is worse than
 * showing nothing.
 *
 * Three things genuinely vary, and all three are available here.
 */
function confidenceFor(episode: SymptomEpisode, severity: number): number {
  const count = episode.symptoms.length;
  if (count === 0) return 0;

  /*
   * 1. Evidence. More symptoms mean more signal, with diminishing returns -
   *    the fourth adds far less than the second. Saturating rather than
   *    linear, for the same reason the score itself is noisy-OR.
   */
  const evidence = 1 - Math.pow(0.6, count);

  /*
   * 2. Margin. This is a threshold classifier, so the honest question is not
   *    "how high is the score" but "how safely is it inside its band". A score
   *    of 54 and a score of 56 are different bands and nearly the same
   *    episode; one slider nudge flips it. Ten points clear of every boundary
   *    is treated as fully settled.
   */
  const distance = Math.min(...BAND_THRESHOLDS.map((t) => Math.abs(severity - t.at)));
  const margin = Math.max(0, Math.min(1, distance / 10));

  /*
   * 3. Specificity. A non-blanching rash points somewhere; fatigue is
   *    compatible with nearly everything, and a symptom the table has no
   *    weight for is one the engine does not know at all - it scored that
   *    one on a default. Averaged, so a single vague entry among specific
   *    ones barely moves it.
   */
  const specificity = episode.symptoms.reduce((sum, sym) => {
    const w = WEIGHT[sym.code];
    if (w === undefined) return sum + 0.5;   // scored on DEFAULT_WEIGHT
    if (w >= 7) return sum + 1;
    if (w >= 4) return sum + 0.85;
    return sum + 0.7;
  }, 0) / count;

  /*
   * Multiplicative, because these are not independent reasons to be
   * confident - they are all conditions that have to hold. Many vague
   * symptoms sitting on a boundary is not a confident reading.
   *
   * The floor is not zero. The engine is deterministic and its rules are
   * visible, so even its weakest reading is better grounded than a guess.
   * The ceiling is not one, and never can be: this is 18 hand-written weights
   * and a threshold table, and a number in the nineties would overstate what
   * that can know. Only a red-flag match reaches higher, in the use case,
   * because that is a rule match rather than an estimate.
   */
  const raw = evidence * margin * specificity;
  return round2(0.25 + 0.6 * raw);
}

/** Two decimal places. The UI renders a whole percentage; spurious precision
 *  in the stored value would imply the engine resolves more finely than it does. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
