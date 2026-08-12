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
import { Classifier, Classification } from '../domain/ports';

/** Clinical weight, 0..10 — how much this symptom moves triage urgency. */
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

    // A rules engine is transparent but blunt; confidence is capped accordingly
    // and is always displayed to the user under QR5.
    const confidence = episode.symptoms.length >= 3 ? 0.62 : 0.45;

    return { severity, confidence, rationale };
  }
}
