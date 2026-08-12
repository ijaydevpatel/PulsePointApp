/**
 * FR5 + QR3 — encrypted local persistence.
 *
 * The key never leaves SecureStore, which is backed by the Android Keystore.
 * SQLCipher is applied via PRAGMA key before any other statement runs; if that
 * ordering is broken the database opens unencrypted, so it is done in init()
 * and nowhere else.
 *
 * All row mapping lives in db/mapping.ts and is unit-tested separately. This
 * file is deliberately thin: it is the part that cannot run without a device.
 */
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { SymptomEpisode, TriageResult } from '../domain/entities';
import { EpisodeStore, HistoryEntry } from '../domain/ports';
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

export class SqliteEpisodeStore implements EpisodeStore {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    const key = await getOrCreateKey();
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // Must be the first statement executed on the connection.
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

  async remove(episodeId: string): Promise<boolean> {
    const res = await this.require().runAsync('DELETE FROM episodes WHERE id = ?', [episodeId]);
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
}
