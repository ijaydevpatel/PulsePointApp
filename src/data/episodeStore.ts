/**
 * The store the app actually runs on.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * App.tsx built an InMemoryEpisodeStore. That is a test double: it keeps
 * everything in a JavaScript array, so every assessment a person ran vanished
 * the moment the app was closed, and Records was permanently empty. The
 * encrypted SQLite store had been written, tested and then never wired in -
 * the screen was reading a real store that happened to hold nothing.
 *
 * ── Why it falls back rather than throwing ───────────────────────────────────
 *
 * SqliteEpisodeStore.init() opens a database, reads a key out of SecureStore
 * and runs migrations. Any of those can fail on a device - a corrupted file,
 * a keystore that will not unlock, storage that is full - and none of them is
 * a reason for the whole app to stop working. History is worth keeping; it is
 * not worth taking Symptoms, Medicines and the Map down for.
 *
 * So a failure degrades to memory: the session still records, the screens
 * still work, and only persistence is lost. `durable` says which happened, so
 * a screen can be honest rather than promising storage it does not have.
 */
import { EpisodeStore, HistoryEntry } from '../domain/ports';
import { SymptomEpisode, TriageResult } from '../domain/entities';
import { SqliteEpisodeStore } from './sqliteStore';
import { InMemoryEpisodeStore } from './memoryStore';

export class DurableEpisodeStore implements EpisodeStore {
  private inner: EpisodeStore = new SqliteEpisodeStore();

  /** False once storage has failed and this is holding things in memory. */
  private persisted = true;

  /**
   * Started once, awaited by everything.
   *
   * SqliteEpisodeStore throws "init() was not awaited" if a statement runs
   * before the database is open, and init is fired from an effect at startup
   * - so a fast enough first save could land before it finished. Every method
   * waits on the same promise rather than trusting the ordering.
   */
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
}
