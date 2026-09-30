/**
 * The history of what was done in the app.
 *
 * Records only ever held symptom checks, because EpisodeStore is the only
 * thing that existed - so looking up a medicine interaction or searching for
 * a pharmacy left no trace, and the screen looked broken rather than narrow.
 *
 * These cover the parts that are decisions rather than plumbing: that a
 * symptom check appears once rather than twice, that a log failure cannot
 * break the feature it is logging, and that clearing means clearing.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(32)),
}));

// eslint-disable-next-line import/first
import { InMemoryEpisodeStore } from '../src/data/memoryStore';
// eslint-disable-next-line import/first
import { ACTIVITY_LABEL, ActivityKind } from '../src/domain/activity';

const entry = (kind: ActivityKind, at: string, episodeId: string | null = null) => ({
  kind, at, title: 'x', detail: null, episodeId,
});

describe('the activity log', () => {
  it('returns newest first', async () => {
    const store = new InMemoryEpisodeStore();
    await store.record(entry('CARE_SEARCH', '2026-09-01T10:00:00.000Z'));
    await store.record(entry('MEDICINE_CHECK', '2026-09-02T10:00:00.000Z'));

    const rows = await store.recent();

    expect(rows.map((r) => r.kind)).toEqual(['MEDICINE_CHECK', 'CARE_SEARCH']);
  });

  it('gives every kind a label, so no row renders blank', () => {
    const kinds: ActivityKind[] = [
      'SYMPTOM_CHECK', 'MEDICINE_CHECK', 'CARE_SEARCH', 'DOCTOR_CHAT',
    ];
    for (const k of kinds) {
      expect(ACTIVITY_LABEL[k]).toBeTruthy();
    }
  });

  it('carries the episode id for a symptom check', async () => {
    /*
     * This is what lets the merged history show one row per check rather than
     * two - the trace row and the clinical record are joined on it, and the
     * richer one wins.
     */
    const store = new InMemoryEpisodeStore();
    await store.record(entry('SYMPTOM_CHECK', '2026-09-02T10:00:00.000Z', 'ep-1'));

    expect((await store.recent())[0]!.episodeId).toBe('ep-1');
  });

  it('clears', async () => {
    const store = new InMemoryEpisodeStore();
    await store.record(entry('CARE_SEARCH', '2026-09-01T10:00:00.000Z'));
    await store.clearActivity();

    expect(await store.recent()).toEqual([]);
  });
});

describe('a log that cannot be written', () => {
  it('does not throw, because it would break what it is logging', async () => {
    /*
     * record() is called from the middle of a user action - running a check,
     * searching for care. If it can fail loudly then a full disk stops the
     * medicine checker from working, which is a far worse outcome than a
     * missing line in a history.
     */
    const { SqliteEpisodeStore } = require('../src/data/sqliteStore');
    const store = new SqliteEpisodeStore();   // never init()ed, so it has no db

    await expect(store.record(entry('CARE_SEARCH', '2026-09-01T10:00:00.000Z')))
      .resolves.toBeUndefined();
    await expect(store.recent()).resolves.toEqual([]);
    await expect(store.clearActivity()).resolves.toBeUndefined();
  });
});
