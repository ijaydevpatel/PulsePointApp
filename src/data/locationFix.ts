/**
 * Working out roughly where the device is, with three independent tiers.
 *
 * ── Why three ────────────────────────────────────────────────────────────────
 *
 * This has now failed three times in a row, each time because a single method
 * was treated as sufficient:
 *
 *   GPS            needs sky, the device toggle, and a prior fix to warm-start
 *                  from. Fails indoors, fails on a fresh emulator.
 *   IP geolocation needs a third-party host to answer. Free ones rate-limit,
 *                  reject unfamiliar user agents, and go down.
 *
 * Neither is reliable alone, and both failing leaves the card with nothing to
 * say. So there is a third tier that cannot fail: the device's own time zone.
 *
 * ── On the time-zone tier ────────────────────────────────────────────────────
 *
 * Every device knows its IANA zone - `Asia/Kolkata`, `Pacific/Auckland` - and
 * a zone names a city. Mapping that to the city's coordinates needs no
 * network, no permission, no hardware, and cannot be rate-limited. It is
 * accurate to the city, which is the resolution air quality and UV are
 * reported at anyway.
 *
 * The coordinates below are fixed, but nothing measured is. They locate a
 * *lookup*; the AQI, UV and humidity at those coordinates are always fetched
 * live. That is the difference between this and the backend's hard-coded
 * `{ aqi: 38, uv: 5, humidity: 62 }`, which asserted readings nobody took.
 */

/** Where the coordinates came from, so the UI can be honest about precision. */
export type FixSource = 'device' | 'network' | 'timezone';

export interface Fix {
  readonly lat: number;
  readonly lon: number;
  readonly source: FixSource;
  /**
   * Place name to show on the card, when one is known.
   *
   * Every tier can supply this: the IP lookup returns a city outright, the
   * time zone is named after one, and a device fix can be reverse-geocoded by
   * the OS. It is still optional, because a reverse geocode is best-effort and
   * a reading without a name beats no reading.
   */
  readonly place?: string;
  /**
   * Radius of uncertainty in metres, when the source reports one.
   *
   * Only a device fix has this. It exists so the UI can say how sure it is
   * rather than implying a precision it does not have - a screen that sends
   * people to hospitals should not quietly round "somewhere in this suburb"
   * to a point on a street.
   */
  readonly accuracyM?: number;
}

/**
 * IANA zone to the coordinates of the city it is named for.
 *
 * Not exhaustive on purpose - it covers the zones with real population, and
 * `zoneFix` degrades through region prefixes for anything missing, so an
 * unlisted zone still lands on the right continent rather than nowhere.
 */
const ZONE_COORDS: Record<string, [number, number, string]> = {
  'Asia/Kolkata': [22.57, 88.36, 'Kolkata'],
  'Asia/Calcutta': [22.57, 88.36, 'Kolkata'],
  'Asia/Dubai': [25.20, 55.27, 'Dubai'],
  'Asia/Karachi': [24.86, 67.01, 'Karachi'],
  'Asia/Dhaka': [23.81, 90.41, 'Dhaka'],
  'Asia/Kathmandu': [27.72, 85.32, 'Kathmandu'],
  'Asia/Colombo': [6.93, 79.86, 'Colombo'],
  'Asia/Singapore': [1.35, 103.82, 'Singapore'],
  'Asia/Tokyo': [35.68, 139.69, 'Tokyo'],
  'Asia/Shanghai': [31.23, 121.47, 'Shanghai'],
  'Asia/Hong_Kong': [22.32, 114.17, 'Hong Kong'],
  'Asia/Seoul': [37.57, 126.98, 'Seoul'],
  'Asia/Jakarta': [-6.21, 106.85, 'Jakarta'],
  'Asia/Manila': [14.60, 120.98, 'Manila'],
  'Asia/Bangkok': [13.76, 100.50, 'Bangkok'],
  'Europe/London': [51.51, -0.13, 'London'],
  'Europe/Dublin': [53.35, -6.26, 'Dublin'],
  'Europe/Paris': [48.86, 2.35, 'Paris'],
  'Europe/Berlin': [52.52, 13.40, 'Berlin'],
  'Europe/Madrid': [40.42, -3.70, 'Madrid'],
  'Europe/Rome': [41.90, 12.50, 'Rome'],
  'Europe/Amsterdam': [52.37, 4.90, 'Amsterdam'],
  'Europe/Moscow': [55.76, 37.62, 'Moscow'],
  'America/New_York': [40.71, -74.01, 'New York'],
  'America/Chicago': [41.88, -87.63, 'Chicago'],
  'America/Denver': [39.74, -104.99, 'Denver'],
  'America/Los_Angeles': [34.05, -118.24, 'Los Angeles'],
  'America/Toronto': [43.65, -79.38, 'Toronto'],
  'America/Vancouver': [49.28, -123.12, 'Vancouver'],
  'America/Mexico_City': [19.43, -99.13, 'Mexico City'],
  'America/Sao_Paulo': [-23.55, -46.63, 'Sao Paulo'],
  'Australia/Sydney': [-33.87, 151.21, 'Sydney'],
  'Australia/Melbourne': [-37.81, 144.96, 'Melbourne'],
  'Australia/Perth': [-31.95, 115.86, 'Perth'],
  'Pacific/Auckland': [-36.85, 174.76, 'Auckland'],
  'Africa/Johannesburg': [-26.20, 28.05, 'Johannesburg'],
  'Africa/Lagos': [6.52, 3.38, 'Lagos'],
  'Africa/Cairo': [30.04, 31.24, 'Cairo'],
  'Africa/Nairobi': [-1.29, 36.82, 'Nairobi'],
};

/** Continent centroids, for a zone the table does not name. */
const REGION_COORDS: Record<string, [number, number, string]> = {
  Asia: [22.57, 88.36, 'Asia'],
  Europe: [51.51, -0.13, 'Europe'],
  America: [40.71, -74.01, 'the Americas'],
  Africa: [6.52, 3.38, 'Africa'],
  Australia: [-33.87, 151.21, 'Australia'],
  Pacific: [-36.85, 174.76, 'the Pacific'],
  Atlantic: [51.51, -0.13, 'the Atlantic'],
  Indian: [-20.16, 57.50, 'the Indian Ocean'],
};

/**
 * The tier that cannot fail.
 *
 * Returns null only if the runtime has no Intl support at all, which no
 * React Native engine in use today lacks.
 */
export function zoneFix(): Fix | null {
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (!zone) return null;

  const exact = ZONE_COORDS[zone];
  if (exact) {
    return { lat: exact[0], lon: exact[1], source: 'timezone', place: exact[2] };
  }

  // 'Asia/Something_Unlisted' still tells us the continent.
  const region = zone.split('/')[0];
  const fallback = region ? REGION_COORDS[region] : undefined;
  if (fallback) {
    return { lat: fallback[0], lon: fallback[1], source: 'timezone', place: fallback[2] };
  }

  return null;
}

/**
 * Whether this reading is a fake one.
 *
 * ── Why this check has to exist ──────────────────────────────────────────────
 *
 * The Android emulator reports a fixed position at Google's headquarters in
 * Mountain View, California, complete with a plausible-looking ±5m accuracy.
 * Nothing about the reading says "invented" except this one flag, so without
 * it the app confidently places a person in Auckland on Amphitheatre Parkway
 * and has every reason to believe itself.
 *
 * Android sets `mocked` for anything coming from a mock location provider -
 * the emulator, a developer setting a position by hand, a location-spoofing
 * app. A mocked fix is worth less than the IP lookup it would otherwise
 * override, because the IP lookup at least reflects a real network the device
 * is really attached to. So it is refused, and the chain falls through.
 *
 * iOS does not report this, and its simulator sets no position at all rather
 * than a wrong one, so the flag being absent is not treated as suspicious.
 */
function isMocked(pos: any): boolean {
  return pos?.mocked === true;
}

/** A position plus, best-effort, the name of the place it is in. */
async function describe(Location: any, pos: any): Promise<Fix> {
  const { latitude, longitude, accuracy } = pos.coords;

  let place: string | undefined;
  try {
    const found = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    const first = Array.isArray(found) ? found[0] : null;
    place = (first?.city || first?.subregion || first?.district || first?.region) ?? undefined;
  } catch { /* a reading without a name is still a reading */ }

  return {
    lat: latitude,
    lon: longitude,
    source: 'device',
    place,
    accuracyM: typeof accuracy === 'number' ? accuracy : undefined,
  };
}

/**
 * The most precise position the device can actually give, taking its time.
 *
 * ── Why this is separate from resolveFix ─────────────────────────────────────
 *
 * They answer different questions. resolveFix answers "roughly where is this
 * person, right now, without making them wait" - which is what a screen needs
 * in order to render at all, and it will settle for the time zone. This one
 * answers "where is this person, precisely", and is allowed to take fifteen
 * seconds and to come back with nothing.
 *
 * ── Why accuracy: High ───────────────────────────────────────────────────────
 *
 * The map asked for `Accuracy.Low`, which on Android is roughly a kilometre -
 * comfortably wider than a city block, and wide enough to name the wrong
 * street. It is the right setting for the air-quality card, which reports at
 * city resolution anyway, and the wrong one for a map someone navigates by.
 * High is around ten metres and turns on GPS to get there.
 *
 * Highest and BestForNavigation are deliberately not used: they are for
 * turn-by-turn, cost a great deal more battery, and take longer to first fix
 * for a precision nobody reads off this screen.
 */
/**
 * The last precise reading, kept for as long as it is plausibly still true.
 *
 * Tabs in this app unmount when you leave them, so without this the Map tab
 * would start from nothing and re-acquire GPS on every single visit - several
 * seconds of "finding you" each time, for a position that has not changed.
 *
 * Module scope rather than a store: it is a cache of a hardware reading, not
 * application state, and nothing should be able to write to it but the reader
 * below.
 */
let lastPrecise: { fix: Fix; at: number } | null = null;

/**
 * A precise reading taken recently enough to still be worth showing.
 *
 * A minute, because that is roughly how far someone gets on foot before the
 * position is misleading, and this screen is read by people deciding where to
 * walk.
 */
export function recentPreciseFix(maxAgeMs = 60_000): Fix | null {
  if (!lastPrecise) return null;
  return Date.now() - lastPrecise.at <= maxAgeMs ? lastPrecise.fix : null;
}

export async function preciseFix(): Promise<Fix | null> {
  try {
    const Location = await import('expo-location');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;
    if (!await Location.hasServicesEnabledAsync()) return null;

    /*
     * Fifteen seconds, because a cold GPS fix indoors routinely takes ten and
     * the old four-second cut-off is part of why this was falling through to
     * the IP tier - which returns the internet provider's idea of the city
     * centre, not where the person is standing.
     */
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);

    if (!pos || isMocked(pos)) return null;

    const fix = await describe(Location, pos);
    lastPrecise = { fix, at: Date.now() };
    return fix;
  } catch {
    return null;
  }
}

/**
 * The same three tiers, for callers that only need a position.
 *
 * conditionsService has its own copy of this chain wired into its weather
 * fetch. This is deliberately a second, smaller entry point rather than a
 * refactor of that one: the environment card on Home works, and rewiring a
 * working screen to give the map a function it could have on its own is a
 * poor trade.
 *
 * A real device position first, otherwise the city from the network,
 * otherwise the time zone - which cannot fail.
 */
export async function resolveFix(): Promise<Fix | null> {
  try {
    const Location = await import('expo-location');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED
        && await Location.hasServicesEnabledAsync()) {
      /*
       * A cached position is a stopgap, not an answer.
       *
       * This used to accept one up to an *hour* old, in preference to asking
       * for a live fix - so the map could place someone on the street they
       * were on when they last opened an app, which is exactly the "it says
       * Albert St, I am on Mayoral Dr" failure. Two minutes is short enough
       * that walking out of range of it is unlikely, and it is only taken
       * when a live reading does not arrive in time.
       */
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      const pos = fresh ?? await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });

      // A mocked position is worth less than the IP lookup below, which at
      // least reflects a network the device is really attached to.
      if (pos && !isMocked(pos)) return await describe(Location, pos);
    }
  } catch { /* module missing, permission thrown, services off - all fine */ }

  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok && (res.headers?.get?.('content-type') ?? '').includes('json')) {
      const data: any = await res.json();
      if (data?.success !== false
          && typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
        return {
          lat: data.latitude,
          lon: data.longitude,
          source: 'network',
          place: (typeof data.city === 'string' && data.city.trim()) || undefined,
        };
      }
    }
  } catch { /* fall through to the tier that cannot fail */ }

  return zoneFix();
}
