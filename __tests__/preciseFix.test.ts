/**
 * How precisely the app decides where the person is.
 *
 * This exists because the Map tab put someone on Albert Street while they
 * stood on Mayoral Drive - about four hundred metres out, on a screen whose
 * whole job is telling people where to go. It was not one bug but three
 * choices that each traded accuracy for speed, in a place where speed was
 * worth much less:
 *
 *   - a cached position up to an *hour* old, preferred over asking the device
 *   - Accuracy.Low, which on Android is roughly a kilometre
 *   - a four-second cut-off, shorter than a cold GPS fix indoors, so the
 *     chain fell through to the IP tier - the internet provider's idea of the
 *     city centre
 *
 * Each of those is asserted below, because each of them looked reasonable in
 * isolation and none of them was.
 */

const position = (lat: number, lon: number, accuracy?: number) => ({
  coords: { latitude: lat, longitude: lon, accuracy },
});

/** A stand-in for expo-location that records what it was asked for. */
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

// Required after the mock is registered, and re-required per test so the
// module under test sees the current stand-in.
const load = () => require('../src/data/locationFix');

beforeEach(() => {
  current = mockLocation();
  jest.resetModules();
});

describe('the precise fix the map runs on', () => {
  it('asks for GPS-grade accuracy, not the cheap tier', async () => {
    /*
     * Accuracy.Low is right for the air-quality card, which reports at city
     * resolution anyway. It is wrong for a map someone navigates by: a
     * kilometre is comfortably wider than a city block, and wide enough to
     * name the wrong street.
     */
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
    /*
     * The website asks the browser twice: enableHighAccuracy with
     * maximumAge 0, then a cheaper pass that will take a cached reading up to
     * a minute old. The app had only the first of those, so indoors - where a
     * high-accuracy attempt just times out - it returned nothing, and the
     * screen fell through to an IP lookup that put the person in the wrong
     * place entirely.
     */
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
    /*
     * The reasons are not interchangeable: a refused permission is fixed in
     * Settings, a disabled service with a toggle, and a device that has not
     * got a fix yet by waiting. Collapsing them into null is what led to
     * quietly substituting an IP lookup.
     */
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
      getCurrentPositionAsync: jest.fn(() => new Promise(() => { /* never */ })),
      // Nothing cached either, or the second stage would rescue it.
      getLastKnownPositionAsync: jest.fn(async () => null),
    });
    jest.resetModules();

    jest.useFakeTimers();
    const { preciseFix } = load();
    const pending = preciseFix();

    /*
     * The cut-off timer is not armed synchronously: preciseFix first awaits
     * the dynamic import, the permission check and the services check, each
     * of which is a microtask hop. Advancing the clock before those settle
     * advances past a timer that does not exist yet, and the test hangs on a
     * promise nothing will ever resolve.
     */
    /*
     * Both stages have to time out, not just the first: fifteen seconds of
     * high accuracy, then twelve of balanced. Each cut-off is armed only
     * after the previous stage's promise settles, so the clock has to be
     * advanced twice with the microtasks flushed in between.
     */
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
    /*
     * The Android emulator reports a fixed position at Google's headquarters
     * in Mountain View, complete with a plausible ±5m accuracy. Nothing about
     * that reading says "invented" except the `mocked` flag, so without this
     * check the app confidently places someone in Auckland CBD on
     * Amphitheatre Parkway - and has every reason to believe itself.
     *
     * A mocked fix is worth less than the IP lookup it would otherwise beat,
     * because the IP lookup at least reflects a network the device is really
     * attached to.
     */
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
    // The guard must key on the flag, not on the accuracy looking too good.
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
    /*
     * It used to take the cached position first, and only ask the device if
     * there was none. That is the difference between "where you are" and
     * "where you were when you last opened something".
     */
    const { resolveFix } = load();
    const fix = await resolveFix();

    expect(current.getCurrentPositionAsync).toHaveBeenCalled();
    expect(fix.lat).toBeCloseTo(-36.8568, 4);
  });

  it('falls through to the network tier when the device reading is mocked', async () => {
    /*
     * The whole point of rejecting a mocked fix: something real has to take
     * its place. On an emulator that is the IP lookup, which puts the person
     * in the right city even though it cannot put them on the right street.
     */
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
