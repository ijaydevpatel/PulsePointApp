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

/** Severity score -> band. Thresholds are policy, kept in one place. */
export function bandForSeverity(severity: number): TriageBand {
  if (severity >= 80) return 'EMERGENCY';
  if (severity >= 55) return 'URGENT';
  if (severity >= 25) return 'PHARMACY_GP';
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
      confidence: c.confidence,
      source: this.classifier.id === 'tflite-v1' ? 'ON_DEVICE_MODEL' : 'ON_DEVICE_RULES',
      redFlags: flags.descriptions,
      rationale: c.rationale,
      syncStatus: 'PENDING_SYNC',
    };

    await this.store.save(episode, result);
    return result;
  }
}
