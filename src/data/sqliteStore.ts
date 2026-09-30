import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { SymptomEpisode, TriageResult } from '../domain/entities';
import { EpisodeStore, HistoryEntry } from '../domain/ports';
import { ActivityEntry, ActivityKind, ActivityLog } from '../domain/activity';
import { SymptomAnalysis } from '../domain/remote';
import { EpisodeRow, fromRow, toRow } from './db/mapping';
import { MIGRATIONS, SCHEMA_VERSION } from './db/schema';

const DB_NAME = 'pulsepoint.db';
const KEY_ID = 'pulsepoint.db.key';

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_ID);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(KEY_ID, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

export class SqliteEpisodeStore implements EpisodeStore, ActivityLog {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    const key = await getOrCreateKey();
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync('PRAGMA journal_mode = WAL;');

    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const current = row?.user_version ?? 0;
    for (let v = current; v < SCHEMA_VERSION; v++) {
      const steps = MIGRATIONS[v];
      if (!steps) continue;
      for (const sql of steps) await db.execAsync(sql);
    }
    if (current < SCHEMA_VERSION) {
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    }
    this.db = db;
  }

  private require(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('SqliteEpisodeStore.init() was not awaited');
    return this.db;
  }

  async save(episode: SymptomEpisode, result: TriageResult): Promise<void> {
    const r = toRow(episode, result);
    await this.require().runAsync(
      `INSERT OR REPLACE INTO episodes
         (id, captured_at, age_band, duration_hours, symptoms_json,
          band, severity, confidence, source, red_flags_json, rationale_json, sync_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.id, r.captured_at, r.age_band, r.duration_hours, r.symptoms_json,
       r.band, r.severity, r.confidence, r.source, r.red_flags_json,
       r.rationale_json, r.sync_status],
    );
  }

  async history(limit = 50): Promise<readonly HistoryEntry[]> {
    const rows = await this.require().getAllAsync<EpisodeRow>(
      'SELECT * FROM episodes ORDER BY captured_at DESC LIMIT ?', [limit],
    );
    return rows.map(fromRow);
  }

  async get(episodeId: string): Promise<HistoryEntry | null> {
    const row = await this.require().getFirstAsync<EpisodeRow>(
      'SELECT * FROM episodes WHERE id = ?', [episodeId],
    );
    return row ? fromRow(row) : null;
  }

  async attachAnalysis(episodeId: string, analysis: SymptomAnalysis): Promise<void> {
    try {
      await this.require().runAsync(
        'UPDATE episodes SET analysis_json = ? WHERE id = ?',
        [JSON.stringify(analysis), episodeId],
      );
    } catch {
    }
  }

  async remove(episodeId: string): Promise<boolean> {
    const res = await this.require().runAsync('DELETE FROM episodes WHERE id = ?', [episodeId]);
    try {
      await this.require().runAsync('DELETE FROM activity WHERE episode_id = ?', [episodeId]);
    } catch {
    }
    return res.changes > 0;
  }

  async clear(): Promise<void> {
    await this.require().execAsync('DELETE FROM episodes;');
  }

  async pendingSync(): Promise<readonly HistoryEntry[]> {
    const rows = await this.require().getAllAsync<EpisodeRow>(
      `SELECT * FROM episodes WHERE sync_status = 'PENDING_SYNC'
       ORDER BY captured_at ASC`,
    );
    return rows.map(fromRow);
  }

  async markSynced(episodeId: string): Promise<void> {
    await this.require().runAsync(
      `UPDATE episodes SET sync_status = 'SYNCED' WHERE id = ?`, [episodeId],
    );
  }

  async record(entry: Omit<ActivityEntry, 'id'>): Promise<void> {
    try {
      const id = `${entry.at}-${Math.random().toString(36).slice(2, 10)}`;
      await this.require().runAsync(
        `INSERT INTO activity (id, kind, at, title, detail, episode_id)
         VALUES (?,?,?,?,?,?)`,
        [id, entry.kind, entry.at, entry.title, entry.detail, entry.episodeId],
      );
    } catch {
    }
  }

  async recent(limit = 100): Promise<readonly ActivityEntry[]> {
    try {
      const rows = await this.require().getAllAsync<{
        id: string; kind: string; at: string;
        detail: string | null; title: string; episode_id: string | null;
      }>('SELECT * FROM activity ORDER BY at DESC LIMIT ?', [limit]);

      return rows.map((r) => ({
        id: r.id,
        kind: r.kind as ActivityKind,
        at: r.at,
        title: r.title,
        detail: r.detail,
        episodeId: r.episode_id,
      }));
    } catch {
      return [];
    }
  }

  async clearActivity(): Promise<void> {
    try {
      await this.require().runAsync('DELETE FROM activity');
    } catch {  }
  }
}
