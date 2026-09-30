export type FixSource = 'device' | 'network' | 'timezone';

export interface Fix {
  readonly lat: number;
  readonly lon: number;
  readonly source: FixSource;

  readonly place?: string;

  readonly accuracyM?: number;
}

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

  const region = zone.split('/')[0];
  const fallback = region ? REGION_COORDS[region] : undefined;
  if (fallback) {
    return { lat: fallback[0], lon: fallback[1], source: 'timezone', place: fallback[2] };
  }

  return null;
}

function isMocked(pos: any): boolean {
  return pos?.mocked === true;
}

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
  } catch {  }

  return {
    lat: latitude,
    lon: longitude,
    source: 'device',
    place,
    accuracyM: typeof accuracy === 'number' ? accuracy : undefined,
  };
}

let lastPrecise: { fix: Fix; at: number } | null = null;

export function recentPreciseFix(maxAgeMs = 60_000): Fix | null {
  if (!lastPrecise) return null;
  return Date.now() - lastPrecise.at <= maxAgeMs ? lastPrecise.fix : null;
}

export type FixOutcome =
  | { kind: 'ok'; fix: Fix }
  | { kind: 'denied' }
  | { kind: 'off' }
  | { kind: 'mocked' }
  | { kind: 'unavailable' };

const within = <T>(work: Promise<T>, ms: number): Promise<T | null> => Promise.race([
  work.catch(() => null),
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
]);

export async function preciseFix(): Promise<FixOutcome> {
  try {
    const Location = await import('expo-location');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return { kind: 'denied' };
    if (!await Location.hasServicesEnabledAsync()) return { kind: 'off' };

    let pos = await within(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      15000,
    );

    if (!pos) {
      pos = await within(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        12000,
      );
    }
    if (!pos) {
      pos = await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000 });
    }

    if (!pos) return { kind: 'unavailable' };
    if (isMocked(pos)) return { kind: 'mocked' };

    const fix = await describe(Location, pos);
    lastPrecise = { fix, at: Date.now() };
    return { kind: 'ok', fix };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function resolveFix(): Promise<Fix | null> {
  try {
    const Location = await import('expo-location');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED
        && await Location.hasServicesEnabledAsync()) {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      const pos = fresh ?? await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });

      if (pos && !isMocked(pos)) return await describe(Location, pos);
    }
  } catch {  }

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
  } catch {  }

  return zoneFix();
}
