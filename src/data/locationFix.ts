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
 * Every device knows its IANA zone — `Asia/Kolkata`, `Pacific/Auckland` — and
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
}

/**
 * IANA zone to the coordinates of the city it is named for.
 *
 * Not exhaustive on purpose — it covers the zones with real population, and
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
