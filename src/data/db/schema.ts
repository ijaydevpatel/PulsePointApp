/**
 * Schema and migrations. user_version is checked on init so an upgrade never
 * silently drops data — Phases 3, 4 and 9 each add tables here.
 */
export const SCHEMA_VERSION = 1;

export const MIGRATIONS: readonly string[][] = [
  // v0 -> v1
  [
    `CREATE TABLE IF NOT EXISTS episodes (
       id             TEXT PRIMARY KEY NOT NULL,
       captured_at    TEXT NOT NULL,
       age_band       TEXT NOT NULL,
       duration_hours INTEGER NOT NULL,
       symptoms_json  TEXT NOT NULL,
       band           TEXT NOT NULL,
       severity       INTEGER NOT NULL,
       confidence     REAL NOT NULL,
       source         TEXT NOT NULL,
       red_flags_json TEXT NOT NULL,
       rationale_json TEXT NOT NULL,
       sync_status    TEXT NOT NULL
     );`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_captured
       ON episodes (captured_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_sync
       ON episodes (sync_status, captured_at ASC);`,
  ],
];
