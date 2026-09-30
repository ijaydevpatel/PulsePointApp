import { SymptomEpisode, TriageResult } from './entities';
import { Drug, InteractionRule } from './medicines';
import { SymptomAnalysis } from './remote';

export interface Classification {
  readonly severity: number;
  readonly confidence: number;
  readonly rationale: readonly string[];
}

export interface Classifier {
  readonly id: string;
  classify(episode: SymptomEpisode): Promise<Classification>;
}

export interface HistoryEntry {
  readonly episode: SymptomEpisode;
  readonly result: TriageResult;
  readonly analysis: SymptomAnalysis | null;
}

export interface EpisodeStore {
  init(): Promise<void>;
  save(episode: SymptomEpisode, result: TriageResult): Promise<void>;
  history(limit?: number): Promise<readonly HistoryEntry[]>;
  get(episodeId: string): Promise<HistoryEntry | null>;

  remove(episodeId: string): Promise<boolean>;
  clear(): Promise<void>;

  pendingSync(): Promise<readonly HistoryEntry[]>;
  markSynced(episodeId: string): Promise<void>;
  attachAnalysis(episodeId: string, analysis: SymptomAnalysis): Promise<void>;
}

export interface InteractionRepository {
  readonly version: string;

  resolve(typed: string): Drug | null;

  rules(): readonly InteractionRule[];
}
