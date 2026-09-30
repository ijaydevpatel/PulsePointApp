import { readFileSync } from 'fs';
import { join } from 'path';

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
    const store = new DurableEpisodeStore();
    for (const method of [
      'init', 'save', 'history', 'get', 'remove', 'clear', 'pendingSync', 'markSynced',
    ]) {
      expect(typeof (store as any)[method]).toBe('function');
    }
  });

  it('falls back to memory rather than taking the app down', async () => {
    const store = new DurableEpisodeStore();
    (store as any).inner = { init: async () => { throw new Error('no storage'); } };

    await expect(store.init()).resolves.toBeUndefined();
    expect(store.durable).toBe(false);

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
