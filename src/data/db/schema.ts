export const SCHEMA_VERSION = 3;

export const MIGRATIONS: readonly string[][] = [

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

  [
    `CREATE TABLE IF NOT EXISTS activity (
       id         TEXT PRIMARY KEY NOT NULL,
       kind       TEXT NOT NULL,
       at         TEXT NOT NULL,
       title      TEXT NOT NULL,
       detail     TEXT,
       episode_id TEXT
     );`,
    `CREATE INDEX IF NOT EXISTS idx_activity_at
       ON activity (at DESC);`,
  ],

  [
    `ALTER TABLE episodes ADD COLUMN analysis_json TEXT;`,
  ],
];
