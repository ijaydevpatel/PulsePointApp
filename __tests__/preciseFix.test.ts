const position = (lat: number, lon: number, accuracy?: number) => ({
  coords: { latitude: lat, longitude: lon, accuracy },
});

function mockLocation(over: Record<string, unknown> = {}) {
  return {
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
    Accuracy: {
      Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6,
    },
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    hasServicesEnabledAsync: jest.fn(async () => true),
    getCurrentPositionAsync: jest.fn(async () => position(-36.8568, 174.7645, 8)),
    getLastKnownPositionAsync: jest.fn(async () => position(-36.8484, 174.7622, 1200)),
    reverseGeocodeAsync: jest.fn(async () => [{ city: 'Auckland' }]),
    ...over,
  };
}

let current = mockLocation();
jest.mock('expo-location', () => current);

const load = () => require('../src/data/locationFix');

beforeEach(() => {
  current = mockLocation();
  jest.resetModules();
});

describe('the precise fix the map runs on', () => {
  it('asks for GPS-grade accuracy, not the cheap tier', async () => {
    const { preciseFix } = load();
    await preciseFix();

    const asked = (current.getCurrentPositionAsync.mock.calls as any[])[0][0];
    expect(asked.accuracy).toBe(current.Accuracy.High);
  });

  it('does not reach for the cache when the device answers', async () => {
    const { preciseFix } = load();
    await preciseFix();

    expect(current.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back the way the website does when high accuracy will not answer', async () => {
    const highThenNothing = jest.fn(async ({ accuracy }: any) => (
      accuracy === 4 ? null : position(-36.8568, 174.7645, 60)
    ));
    current = mockLocation({ getCurrentPositionAsync: highThenNothing });
    jest.resetModules();

    const { preciseFix } = load();
    const out = await preciseFix();

    const asked = (highThenNothing.mock.calls as any[]).map((c) => c[0].accuracy);
    expect(asked).toEqual([current.Accuracy.High, current.Accuracy.Balanced]);
    expect(out.kind).toBe('ok');
  });

  it('takes a recent cached reading before giving up entirely', async () => {
    current = mockLocation({ getCurrentPositionAsync: jest.fn(async () => null) });
    jest.resetModules();

    const { preciseFix } = load();
    const out = await preciseFix();

    const asked = (current.getLastKnownPositionAsync.mock.calls as any[])[0][0];
    expect(asked.maxAge).toBe(60 * 1000);
    expect(out.kind).toBe('ok');
  });

  it('says why there is no position, rather than just failing', async () => {
    current = mockLocation({
      hasServicesEnabledAsync: jest.fn(async () => false),
    });
    jest.resetModules();
    expect((await load().preciseFix()).kind).toBe('off');

    current = mockLocation({
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
    });
    jest.resetModules();
    expect((await load().preciseFix()).kind).toBe('denied');

    current = mockLocation({
      getCurrentPositionAsync: jest.fn(async () => ({
        ...position(37.422, -122.084, 5), mocked: true,
      })),
    });
    jest.resetModules();
    expect((await load().preciseFix()).kind).toBe('mocked');
  });

  it('reports how accurate the reading actually was', async () => {
    const { preciseFix } = load();
    const out = await preciseFix();

    expect(out.kind).toBe('ok');
    expect(out.fix.accuracyM).toBe(8);
    expect(out.fix.source).toBe('device');
    expect(out.fix.lat).toBeCloseTo(-36.8568, 4);
  });

  it('gives up rather than guessing when the device will not say', async () => {
    current = mockLocation({
      getCurrentPositionAsync: jest.fn(() => new Promise(() => {  })),

      getLastKnownPositionAsync: jest.fn(async () => null),
    });
    jest.resetModules();

    jest.useFakeTimers();
    const { preciseFix } = load();
    const pending = preciseFix();

    for (const _ of [0, 1]) {
      for (let i = 0; i < 30; i += 1) await Promise.resolve();
      jest.advanceTimersByTime(20000);
    }
    for (let i = 0; i < 30; i += 1) await Promise.resolve();

    const out = await pending;
    jest.useRealTimers();

    expect(out.kind).toBe('unavailable');
  });

  it('refuses a mocked reading, however precise it claims to be', async () => {
    current = mockLocation({
      getCurrentPositionAsync: jest.fn(async () => ({
        ...position(37.4220, -122.0840, 5),
        mocked: true,
      })),
    });
    jest.resetModules();

    const { preciseFix } = load();
    expect((await preciseFix()).kind).not.toBe('ok');
  });

  it('accepts a real reading that happens to be precise', async () => {
    current = mockLocation({
      getCurrentPositionAsync: jest.fn(async () => ({
        ...position(-36.8568, 174.7645, 5),
        mocked: false,
      })),
    });
    jest.resetModules();

    const { preciseFix } = load();
    const out = await preciseFix();

    expect(out.kind).toBe('ok');
    expect(out.fix.accuracyM).toBe(5);
  });

  it('returns nothing without permission, rather than a worse answer', async () => {
    current = mockLocation({
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
    });
    jest.resetModules();

    const { preciseFix } = load();

    expect((await preciseFix()).kind).not.toBe('ok');
    expect(current.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});

describe('the quick fix the app starts with', () => {
  it('asks the device before reaching for the cache', async () => {
    const { resolveFix } = load();
    const fix = await resolveFix();

    expect(current.getCurrentPositionAsync).toHaveBeenCalled();
    expect(fix.lat).toBeCloseTo(-36.8568, 4);
  });

  it('falls through to the network tier when the device reading is mocked', async () => {
    current = mockLocation({
      getCurrentPositionAsync: jest.fn(async () => ({
        ...position(37.4220, -122.0840, 5),
        mocked: true,
      })),
    });
    jest.resetModules();

    const fetchSpy = jest.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ latitude: -36.8485, longitude: 174.7633, city: 'Auckland' }),
    }));
    (global as any).fetch = fetchSpy;

    const { resolveFix } = load();
    const fix = await resolveFix();

    expect(fetchSpy).toHaveBeenCalled();
    expect(fix.source).toBe('network');
    expect(fix.place).toBe('Auckland');
    expect(fix.lat).toBeCloseTo(-36.8485, 3);
  });

  it('will not accept a cached position older than a couple of minutes', async () => {
    current = mockLocation({
      getCurrentPositionAsync: jest.fn(async () => null),
    });
    jest.resetModules();

    const { resolveFix } = load();
    await resolveFix();

    const asked = (current.getLastKnownPositionAsync.mock.calls as any[])[0][0];
    expect(asked.maxAge).toBeLessThanOrEqual(2 * 60 * 1000);
  });
});
