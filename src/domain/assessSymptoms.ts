import {
  SymptomEpisode, TriageResult, TriageBand, maxBand,
} from './entities';
import { detectRedFlags } from './redFlags';
import { Classifier, EpisodeStore } from './ports';

export const BAND_THRESHOLDS: readonly { at: number; band: TriageBand }[] = [
  { at: 80, band: 'EMERGENCY' },
  { at: 55, band: 'URGENT' },
  { at: 25, band: 'PHARMACY_GP' },
];

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

  /**
   * Scores the episode without writing it. The caller saves once it has
   * everything it intends to keep, so a record is never stored half-made.
   */
  async assess(episode: SymptomEpisode): Promise<TriageResult> {
    const flags = detectRedFlags(episode);

    const c = await this.classifier.classify(episode);

    const scoredBand = bandForSeverity(c.severity);
    const band = flags.band ? maxBand(flags.band, scoredBand) : scoredBand;

    const result: TriageResult = {
      episodeId: episode.id,
      band,
      severity: flags.band === 'EMERGENCY' ? Math.max(c.severity, 85) : c.severity,

      confidence: flags.band ? Math.max(c.confidence, 0.9) : c.confidence,
      source: this.classifier.id === 'tflite-v1' ? 'ON_DEVICE_MODEL' : 'ON_DEVICE_RULES',
      redFlags: flags.descriptions,
      rationale: c.rationale,
      syncStatus: 'PENDING_SYNC',
    };

    return result;
  }

  /** Scores and saves in one step. */
  async execute(episode: SymptomEpisode): Promise<TriageResult> {
    const result = await this.assess(episode);
    await this.store.save(episode, result);
    return result;
  }
}
