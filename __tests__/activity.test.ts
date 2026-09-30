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
    const { SqliteEpisodeStore } = require('../src/data/sqliteStore');
    const store = new SqliteEpisodeStore();

    await expect(store.record(entry('CARE_SEARCH', '2026-09-01T10:00:00.000Z')))
      .resolves.toBeUndefined();
    await expect(store.recent()).resolves.toEqual([]);
    await expect(store.clearActivity()).resolves.toBeUndefined();
  });
});

describe('deleting a check', () => {
  it('takes its history row with it', async () => {
    const store = new InMemoryEpisodeStore();

    await store.save(
      { id: 'ep-1', capturedAt: '2026-09-30T10:00:00.000Z', ageBand: 'ADULT', durationHours: 6, symptoms: [] },
      { episodeId: 'ep-1', band: 'SELF_CARE', severity: 10, confidence: 0.4,
        source: 'ON_DEVICE_RULES', redFlags: [], rationale: [], syncStatus: 'PENDING_SYNC' },
    );
    await store.record(entry('SYMPTOM_CHECK', '2026-09-30T10:00:00.000Z', 'ep-1'));

    await store.remove('ep-1');

    expect(await store.history()).toEqual([]);
    expect(await store.recent()).toEqual([]);
  });

  it('leaves other rows alone', async () => {
    const store = new InMemoryEpisodeStore();
    await store.record(entry('CARE_SEARCH', '2026-09-30T09:00:00.000Z'));
    await store.record(entry('SYMPTOM_CHECK', '2026-09-30T10:00:00.000Z', 'ep-1'));

    await store.remove('ep-1');

    const left = await store.recent();
    expect(left).toHaveLength(1);
    expect(left[0]!.kind).toBe('CARE_SEARCH');
  });
});
