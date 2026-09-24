/**
 * AssessSymptomsUseCase - FR1, FR2, FR3, QR5.
 *
 * Ordering is the safety-critical part:
 *   1. red-flag rules run FIRST and can never be suppressed
 *   2. the classifier scores the episode
 *   3. the two are combined so the result can only ever escalate, never de-escalate
 */
import {
  SymptomEpisode, TriageResult, TriageBand, maxBand,
} from './entities';
import { detectRedFlags } from './redFlags';
import { Classifier, EpisodeStore } from './ports';

/**
 * Where one band becomes the next. Policy, kept in one place.
 *
 * Exported because the classifier needs them too: how close a score sits to a
 * boundary is most of what decides how much the band can be trusted, and a
 * second copy of these numbers there would drift.
 */
export const BAND_THRESHOLDS: readonly { at: number; band: TriageBand }[] = [
  { at: 80, band: 'EMERGENCY' },
  { at: 55, band: 'URGENT' },
  { at: 25, band: 'PHARMACY_GP' },
];

/** Severity score -> band. */
export function bandForSeverity(severity: number): TriageBand {
  for (const t of BAND_THRESHOLDS) {
    if (severity >= t.at) return t.band;
  }
  return 'SELF_CARE';
}

export class AssessSymptomsUseCase {
  constructor(
    private readonly classifier: Classifier,
    private readonly store: EpisodeStore,
  ) {}

  async execute(episode: SymptomEpisode): Promise<TriageResult> {
    // 1. Red flags first - always, regardless of what the classifier says.
    const flags = detectRedFlags(episode);

    // 2. Score.
    const c = await this.classifier.classify(episode);

    // 3. Combine. QR5: low confidence may soften the *score*, never the escalation.
    const scoredBand = bandForSeverity(c.severity);
    const band = flags.band ? maxBand(flags.band, scoredBand) : scoredBand;

    const result: TriageResult = {
      episodeId: episode.id,
      band,
      severity: flags.band === 'EMERGENCY' ? Math.max(c.severity, 85) : c.severity,
      /*
       * A red flag is a deterministic rule match, not an estimate.
       *
       * When one decides the band, the app's confidence in that decision does
       * not depend on how blunt the scorer was - the rule either matched the
       * reported symptoms or it did not. Showing "45% confidence" beside
       * "Emergency - call 111" invites someone to second-guess an instruction
       * the app means, which is the opposite of what a confidence figure is
       * for. Only ever a floor: a classifier that is more certain keeps its
       * number.
       */
      confidence: flags.band ? Math.max(c.confidence, 0.9) : c.confidence,
      source: this.classifier.id === 'tflite-v1' ? 'ON_DEVICE_MODEL' : 'ON_DEVICE_RULES',
      redFlags: flags.descriptions,
      rationale: c.rationale,
      syncStatus: 'PENDING_SYNC',
    };

    await this.store.save(episode, result);
    return result;
  }
}
