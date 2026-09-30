import { EpisodeStore, HistoryEntry } from '../domain/ports';
import { ActivityEntry, ActivityLog } from '../domain/activity';
import { SymptomAnalysis } from '../domain/remote';
import { SymptomEpisode, TriageResult } from '../domain/entities';
import { SqliteEpisodeStore } from './sqliteStore';
import { InMemoryEpisodeStore } from './memoryStore';

export class DurableEpisodeStore implements EpisodeStore, ActivityLog {
  private inner: EpisodeStore & ActivityLog = new SqliteEpisodeStore();

  private persisted = true;

  private opening: Promise<void> | null = null;

  get durable(): boolean {
    return this.persisted;
  }

  init(): Promise<void> {
    this.opening ??= (async () => {
      try {
        await this.inner.init();
      } catch {
        this.inner = new InMemoryEpisodeStore();
        this.persisted = false;
        await this.inner.init();
      }
    })();

    return this.opening;
  }

  async save(episode: SymptomEpisode, result: TriageResult): Promise<void> {
    await this.init();
    return this.inner.save(episode, result);
  }

  async history(limit?: number): Promise<readonly HistoryEntry[]> {
    await this.init();
    return this.inner.history(limit);
  }

  async get(episodeId: string): Promise<HistoryEntry | null> {
    await this.init();
    return this.inner.get(episodeId);
  }

  async remove(episodeId: string): Promise<boolean> {
    await this.init();
    return this.inner.remove(episodeId);
  }

  async clear(): Promise<void> {
    await this.init();
    return this.inner.clear();
  }

  async pendingSync(): Promise<readonly HistoryEntry[]> {
    await this.init();
    return this.inner.pendingSync();
  }

  async markSynced(episodeId: string): Promise<void> {
    await this.init();
    return this.inner.markSynced(episodeId);
  }

  async attachAnalysis(episodeId: string, analysis: SymptomAnalysis): Promise<void> {
    await this.init();
    return this.inner.attachAnalysis(episodeId, analysis);
  }

  async record(entry: Omit<ActivityEntry, 'id'>): Promise<void> {
    await this.init();
    return this.inner.record(entry);
  }

  async recent(limit?: number): Promise<readonly ActivityEntry[]> {
    await this.init();
    return this.inner.recent(limit);
  }

  async clearActivity(): Promise<void> {
    await this.init();
    return this.inner.clearActivity();
  }
}
