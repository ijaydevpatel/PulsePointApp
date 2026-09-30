import { InMemoryEpisodeStore } from '../src/data/memoryStore';
import { toRow, fromRow, RowCorruptError, EpisodeRow } from '../src/data/db/mapping';
import { SymptomEpisode, TriageResult } from '../src/domain/entities';
import { EpisodeStore } from '../src/domain/ports';

const ep = (id: string, capturedAt: string): SymptomEpisode => ({
  id, capturedAt, ageBand: 'ADULT', durationHours: 6,
  symptoms: [{ code: 'cough', label: 'Cough', severity: 4 }],
});

const res = (id: string, over: Partial<TriageResult> = {}): TriageResult => ({
  episodeId: id, band: 'PHARMACY_GP', severity: 40, confidence: 0.62,
  source: 'ON_DEVICE_RULES', redFlags: [], rationale: ['Cough at 4/10'],
  syncStatus: 'PENDING_SYNC', ...over,
});

describe('EpisodeStore contract', () => {
  let store: EpisodeStore;
  beforeEach(async () => { store = new InMemoryEpisodeStore(); await store.init(); });

  it('saves and reads back an episode', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    const got = await store.get('a');
    expect(got?.result.band).toBe('PHARMACY_GP');
    expect(got?.episode.symptoms[0]?.code).toBe('cough');
  });

  it('returns history newest first', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    await store.save(ep('b', '2026-08-03T10:00:00Z'), res('b'));
    await store.save(ep('c', '2026-08-02T10:00:00Z'), res('c'));
    expect((await store.history()).map((h) => h.episode.id)).toEqual(['b', 'c', 'a']);
  });

  it('honours the history limit', async () => {
    for (let i = 0; i < 10; i++) {
      await store.save(ep(`e${i}`, `2026-08-0${i % 9 + 1}T10:00:00Z`), res(`e${i}`));
    }
    expect((await store.history(3)).length).toBe(3);
  });

  it('replaces rather than duplicates on the same id', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a', { band: 'URGENT' }));
    expect((await store.history()).length).toBe(1);
    expect((await store.get('a'))?.result.band).toBe('URGENT');
  });

  it('deletes a single episode and reports whether one went (FR5)', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    expect(await store.remove('a')).toBe(true);
    expect(await store.remove('a')).toBe(false);
    expect(await store.get('a')).toBeNull();
  });

  it('clears everything', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    await store.save(ep('b', '2026-08-02T10:00:00Z'), res('b'));
    await store.clear();
    expect((await store.history()).length).toBe(0);
  });

  it('lists pending-sync episodes oldest first (R2)', async () => {
    await store.save(ep('a', '2026-08-03T10:00:00Z'), res('a'));
    await store.save(ep('b', '2026-08-01T10:00:00Z'), res('b'));
    await store.save(ep('c', '2026-08-02T10:00:00Z'), res('c', { syncStatus: 'SYNCED' }));
    expect((await store.pendingSync()).map((h) => h.episode.id)).toEqual(['b', 'a']);
  });

  it('markSynced is idempotent (R2, criterion E8)', async () => {
    await store.save(ep('a', '2026-08-01T10:00:00Z'), res('a'));
    await store.markSynced('a');
    await store.markSynced('a');
    expect((await store.pendingSync()).length).toBe(0);
    expect((await store.get('a'))?.result.syncStatus).toBe('SYNCED');
  });
});

describe('row mapping', () => {
  it('round-trips without loss', () => {
    const e = ep('a', '2026-08-01T10:00:00Z');
    const r = res('a', { redFlags: ['Chest pain with breathlessness'] });
    const back = fromRow(toRow(e, r));
    expect(back.episode).toEqual(e);
    expect(back.result).toEqual(r);
  });

  it('rejects a corrupt band rather than returning a wrong triage', () => {
    const row = { ...toRow(ep('a', '2026-08-01T10:00:00Z'), res('a')), band: 'MILD' } as EpisodeRow;
    expect(() => fromRow(row)).toThrow(RowCorruptError);
  });

  it('rejects malformed JSON rather than crashing on undefined later', () => {
    const row = { ...toRow(ep('a', '2026-08-01T10:00:00Z'), res('a')), symptoms_json: '{oops' } as EpisodeRow;
    expect(() => fromRow(row)).toThrow(RowCorruptError);
  });
});
