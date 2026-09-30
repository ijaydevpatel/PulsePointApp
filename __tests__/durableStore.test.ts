/**
 * Records have to survive closing the app.
 *
 * ── The bug this pins ────────────────────────────────────────────────────────
 *
 * App.tsx built an InMemoryEpisodeStore - a test double that keeps everything
 * in a JavaScript array. Every assessment a person ran vanished when the app
 * closed, and the Records screen was permanently empty. The encrypted SQLite
 * store had been written, tested, and never wired in.
 *
 * Nothing failed. There was no error, no warning, and no empty-state bug to
 * find: the screen was reading a real store that happened to hold nothing.
 * That is why this is a test about *which* store is constructed, which is
 * otherwise a strange thing to assert.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The native modules the SQLite store pulls in. They cannot load under Jest,
 * and none of them is what is under test here - this file is about which
 * store gets built and how it behaves when storage fails, both of which are
 * decided before any native call happens.
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
import { DurableEpisodeStore } from '../src/data/episodeStore';

const APP = readFileSync(join(__dirname, '..', 'src', 'ui', 'App.tsx'), 'utf8');

describe('the store the app runs on', () => {
  it('is not the in-memory double', () => {
    expect(APP).not.toContain('new InMemoryEpisodeStore()');
    expect(APP).toContain('new DurableEpisodeStore()');
  });

  it('implements everything the port asks for', async () => {
    /*
     * A decorator that forgets a method fails at the call site, on a device,
     * in whichever screen happens to use it - long after the mistake.
     */
    const store = new DurableEpisodeStore();
    for (const method of [
      'init', 'save', 'history', 'get', 'remove', 'clear', 'pendingSync', 'markSynced',
    ]) {
      expect(typeof (store as any)[method]).toBe('function');
    }
  });

  it('falls back to memory rather than taking the app down', async () => {
    /*
     * init opens a database, reads a key out of SecureStore and runs
     * migrations. Any of those can fail on a device, and none of them is a
     * reason for Symptoms, Medicines and the Map to stop working.
     */
    const store = new DurableEpisodeStore();
    (store as any).inner = { init: async () => { throw new Error('no storage'); } };

    await expect(store.init()).resolves.toBeUndefined();
    expect(store.durable).toBe(false);

    // And it still works, in memory.
    await expect(store.history()).resolves.toEqual([]);
  });

  it('opens once, however many callers ask', async () => {
    let opens = 0;
    const store = new DurableEpisodeStore();
    (store as any).inner = {
      init: async () => { opens += 1; },
      history: async () => [],
    };

    await Promise.all([store.init(), store.history(), store.history()]);

    expect(opens).toBe(1);
  });

  it('waits for the database before touching it', async () => {
    /*
     * SqliteEpisodeStore throws "init() was not awaited" if a statement runs
     * before the database is open, and init is fired from an effect at
     * startup - so a fast first save could land before it finished.
     */
    const order: string[] = [];
    const store = new DurableEpisodeStore();
    (store as any).inner = {
      init: async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push('open');
      },
      history: async () => { order.push('read'); return []; },
    };

    await store.history();

    expect(order).toEqual(['open', 'read']);
  });
});
