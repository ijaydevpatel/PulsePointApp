import { SymptomEpisode } from '../domain/entities';
import { BAND_THRESHOLDS } from '../domain/assessSymptoms';
import { Classifier, Classification } from '../domain/ports';

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

    let survive = 1;
    for (const s of episode.symptoms) {
      const w = WEIGHT[s.code] ?? DEFAULT_WEIGHT;
      const sev = Math.max(0, Math.min(10, s.severity));
      const risk = Math.min(0.93, (w / 10) * (sev / 10));
      survive *= 1 - risk;
      if (risk >= 0.3) rationale.push(`${s.label} at ${sev}/10`);
    }
    let score = 1 - survive;

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

function confidenceFor(episode: SymptomEpisode, severity: number): number {
  const count = episode.symptoms.length;
  if (count === 0) return 0;

  const evidence = 1 - Math.pow(0.6, count);

  const distance = Math.min(...BAND_THRESHOLDS.map((t) => Math.abs(severity - t.at)));
  const margin = Math.max(0, Math.min(1, distance / 10));

  const specificity = episode.symptoms.reduce((sum, sym) => {
    const w = WEIGHT[sym.code];
    if (w === undefined) return sum + 0.5;
    if (w >= 7) return sum + 1;
    if (w >= 4) return sum + 0.85;
    return sum + 0.7;
  }, 0) / count;

  const raw = evidence * margin * specificity;
  return round2(0.25 + 0.6 * raw);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
