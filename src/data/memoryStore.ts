import { SymptomEpisode, TriageResult } from '../domain/entities';
import { EpisodeStore, HistoryEntry } from '../domain/ports';
import { ActivityEntry, ActivityLog } from '../domain/activity';
import { SymptomAnalysis } from '../domain/remote';

export class InMemoryEpisodeStore implements EpisodeStore, ActivityLog {
  private trace: ActivityEntry[] = [];

  private rows: HistoryEntry[] = [];

  async init(): Promise<void> {}

  async save(episode: SymptomEpisode, result: TriageResult): Promise<void> {
    const entry: HistoryEntry = { episode, result, analysis: null };
    const i = this.rows.findIndex((r) => r.episode.id === episode.id);
    if (i >= 0) this.rows[i] = entry;
    else this.rows.unshift(entry);
    this.rows.sort((a, b) => b.episode.capturedAt.localeCompare(a.episode.capturedAt));
  }

  async history(limit = 50): Promise<readonly HistoryEntry[]> {
    return this.rows.slice(0, limit);
  }

  async get(episodeId: string): Promise<HistoryEntry | null> {
    return this.rows.find((r) => r.episode.id === episodeId) ?? null;
  }

  async attachAnalysis(episodeId: string, analysis: SymptomAnalysis): Promise<void> {
    const i = this.rows.findIndex((r) => r.episode.id === episodeId);
    const row = this.rows[i];
    if (row) this.rows[i] = { ...row, analysis };
  }

  async remove(episodeId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.episode.id !== episodeId);
    this.trace = this.trace.filter((a) => a.episodeId !== episodeId);
    return this.rows.length < before;
  }

  async clear(): Promise<void> {
    this.rows = [];
  }

  async pendingSync(): Promise<readonly HistoryEntry[]> {
    return this.rows
      .filter((r) => r.result.syncStatus === 'PENDING_SYNC')
      .sort((a, b) => a.episode.capturedAt.localeCompare(b.episode.capturedAt));
  }

  async markSynced(episodeId: string): Promise<void> {
    const i = this.rows.findIndex((r) => r.episode.id === episodeId);
    const row = this.rows[i];
    if (row) {
      this.rows[i] = {
        episode: row.episode,
        result: { ...row.result, syncStatus: 'SYNCED' },
        analysis: row.analysis,
      };
    }
  }

  async record(entry: Omit<ActivityEntry, 'id'>): Promise<void> {
    this.trace.unshift({ ...entry, id: `${entry.at}-${this.trace.length}` });
  }

  async recent(limit = 100): Promise<readonly ActivityEntry[]> {
    return this.trace.slice(0, limit);
  }

  async clearActivity(): Promise<void> {
    this.trace = [];
  }
}
