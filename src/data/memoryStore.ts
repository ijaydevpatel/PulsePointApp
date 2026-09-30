/**
 * In-memory EpisodeStore. Used by unit tests and by the workstation build,
 * so the domain and UI can be exercised with no device and no emulator.
 * Behaviour must match SqliteEpisodeStore - the shared contract test in
 * __tests__/store.test.ts runs against this implementation.
 */
import { SymptomEpisode, TriageResult } from '../domain/entities';
import { EpisodeStore, HistoryEntry } from '../domain/ports';
import { ActivityEntry, ActivityLog } from '../domain/activity';

export class InMemoryEpisodeStore implements EpisodeStore, ActivityLog {
  private trace: ActivityEntry[] = [];

  private rows: HistoryEntry[] = [];

  async init(): Promise<void> {}

  async save(episode: SymptomEpisode, result: TriageResult): Promise<void> {
    const entry: HistoryEntry = { episode, result };
    const i = this.rows.findIndex((r) => r.episode.id === episode.id);
    if (i >= 0) this.rows[i] = entry;      // INSERT OR REPLACE
    else this.rows.unshift(entry);
    this.rows.sort((a, b) => b.episode.capturedAt.localeCompare(a.episode.capturedAt));
  }

  async history(limit = 50): Promise<readonly HistoryEntry[]> {
    return this.rows.slice(0, limit);
  }

  async get(episodeId: string): Promise<HistoryEntry | null> {
    return this.rows.find((r) => r.episode.id === episodeId) ?? null;
  }

  async remove(episodeId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.episode.id !== episodeId);
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
      this.rows[i] = { episode: row.episode, result: { ...row.result, syncStatus: 'SYNCED' } };
    }
  }

  /* Activity, for the session only - this is the fallback when storage fails. */

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
