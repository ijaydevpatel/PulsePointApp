/**
 * Interfaces the domain requires. The data layer implements them.
 * This inversion is requirement L1: swapping the rules engine for the
 * quantised TFLite model in Phase 6 touches only the implementation.
 */
import { SymptomEpisode, TriageResult } from './entities';

export interface Classification {
  readonly severity: number;   // 0..100
  readonly confidence: number; // 0..1
  readonly rationale: readonly string[];
}

/** IClassifier — RuleClassifier now, TFLiteClassifier in Phase 6. */
export interface Classifier {
  readonly id: string;
  classify(episode: SymptomEpisode): Promise<Classification>;
}

/** One stored triage, joined back to the episode that produced it. */
export interface HistoryEntry {
  readonly episode: SymptomEpisode;
  readonly result: TriageResult;
}

/**
 * IEpisodeStore — FR5. InMemory for tests, SQLCipher-backed on device.
 * Every read and write goes through here so encryption is enforced at one
 * point rather than at each call site (requirement L3).
 */
export interface EpisodeStore {
  init(): Promise<void>;
  save(episode: SymptomEpisode, result: TriageResult): Promise<void>;
  history(limit?: number): Promise<readonly HistoryEntry[]>;
  get(episodeId: string): Promise<HistoryEntry | null>;
  /** FR5 requires the user to be able to delete. Returns true if a row went. */
  remove(episodeId: string): Promise<boolean>;
  clear(): Promise<void>;
  /** R2: episodes still awaiting enrichment, oldest first. Used in Phase 8. */
  pendingSync(): Promise<readonly HistoryEntry[]>;
  markSynced(episodeId: string): Promise<void>;
}
