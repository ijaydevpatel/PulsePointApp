import * as Location from 'expo-location';
import { Conditions, ConditionsService, LocationState } from '../domain/remote';
import { Fix, zoneFix } from './locationFix';

const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER = 'https://api.open-meteo.com/v1/forecast';

const IP_LOOKUPS = [
  'https://ipwho.is/',
  'https://ipapi.co/json/',
] as const;

const NET_TIMEOUT_MS = 8000;

const FIX_TIMEOUT_MS = 4000;

async function getJson(url: string, timeoutMs = NET_TIMEOUT_MS): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return null;

    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function firstNumber(series: unknown): number | null {
  if (!Array.isArray(series)) return null;
  for (const v of series) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

const isCoord = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

async function placeName(lat: number, lon: number): Promise<string | undefined> {
  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    const first = Array.isArray(results) ? results[0] : null;
    if (!first) return undefined;

    const name = first.city || first.subregion || first.district || first.region;
    return name ?? undefined;
  } catch {
    return undefined;
  }
}

async function deviceFix(): Promise<Fix | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    if (!(await Location.hasServicesEnabledAsync())) return null;

    const cached = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
    const pos = cached ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (!pos) return null;

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    return { lat, lon, source: 'device', place: await placeName(lat, lon) };
  } catch {
    return null;
  }
}

async function networkFix(): Promise<Fix | null> {
  for (const url of IP_LOOKUPS) {
    const data = await getJson(url);

    if (data && data.success === false) continue;

    const lat = data?.latitude;
    const lon = data?.longitude;
    if (!isCoord(lat) || !isCoord(lon)) continue;

    const city = typeof data?.city === 'string' ? data.city.trim() : '';
    const region = typeof data?.region === 'string' ? data.region.trim() : '';

    return { lat, lon, source: 'network', place: city || region || undefined };
  }
  return null;
}

export class OpenMeteoConditions implements ConditionsService {
  async current(): Promise<{ state: LocationState; data: Conditions | null; notice: string | null }> {
    const fix = (await deviceFix()) ?? (await networkFix()) ?? zoneFix();

    if (!fix) {
      return {
        state: 'UNAVAILABLE',
        data: null,
        notice: 'Conditions are unavailable right now.',
      };
    }

    const { lat, lon } = fix;

    const [air, weather] = await Promise.all([
      getJson(`${AIR}?latitude=${lat}&longitude=${lon}&hourly=european_aqi,us_aqi&timezone=auto&forecast_days=1`),
      getJson(`${WEATHER}?latitude=${lat}&longitude=${lon}&current=relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`),
    ]);

    const aqi = firstNumber(air?.hourly?.us_aqi) ?? firstNumber(air?.hourly?.european_aqi);
    const uvIndex = firstNumber(weather?.daily?.uv_index_max);
    const humidityRaw = weather?.current?.relative_humidity_2m;
    const humidity = isCoord(humidityRaw) ? humidityRaw : null;

    if (aqi === null && uvIndex === null && humidity === null) {
      return {
        state: 'UNAVAILABLE',
        data: null,
        notice: 'Conditions are unavailable right now.',
      };
    }

    return {
      state: 'OK',
      data: { uvIndex, aqi, humidity, lat, lon, source: fix.source, place: fix.place ?? null },
      notice: null,
    };
  }
}
