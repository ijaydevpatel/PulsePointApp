/**
 * Real environmental conditions for wherever the person is.
 *
 * ── Why this does not come from our own backend ──────────────────────────────
 *
 * `/api/dashboard/intel` used to return `{ aqi: 38, uv: 5, humidity: 62 }` —
 * the same three numbers for every user, every request, marked "Static
 * fallback" in the route. Rendering those as measurements is the thing this
 * file exists to avoid.
 *
 * Open-Meteo is used instead: free, no API key, no account, no request
 * signing — so nothing secret has to ship in the app. Two endpoints, because
 * air quality and weather are separate products there.
 *
 * ── Why GPS is not required ──────────────────────────────────────────────────
 *
 * Two earlier attempts at this failed on a real device, and both failed for
 * the same underlying reason: they treated a satellite fix as mandatory.
 *
 * It is not. Air quality and UV are regional — the reading is identical
 * anywhere within several kilometres — so the precision GPS provides is
 * precision this feature throws away. Meanwhile a GPS fix is the single most
 * failure-prone thing a phone can be asked for: it needs sky, it needs the
 * device toggle on, it needs a prior fix to warm-start from, and on an
 * emulator it needs a position to have been set by hand. Any one of those
 * missing and the card stalls.
 *
 * So the order is now: use a position if one is readily available, and
 * otherwise resolve the city from the network. The second path needs no
 * permission, no hardware and no settings, which means the card has a working
 * answer in every state the first path fails in.
 *
 * ── Failure is a state, not an exception ─────────────────────────────────────
 *
 * Every field is nullable and every path returns a notice rather than
 * throwing. A missing reading renders as an em dash. The one thing this must
 * never do is substitute a default: a humidity figure that is really a
 * fallback constant is indistinguishable, on screen, from a measurement.
 */
import * as Location from 'expo-location';
import { Conditions, ConditionsService, LocationState } from '../domain/remote';
import { Fix, zoneFix } from './locationFix';

const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER = 'https://api.open-meteo.com/v1/forecast';

/**
 * City-level coordinates from the network route, keyless and permissionless.
 *
 * Accuracy is roughly city-scale, which is the resolution this feature
 * actually uses. It sees the device's public IP — but so does every server the
 * app already talks to, including Open-Meteo itself, so this reveals nothing
 * that was not already in transit.
 */
const IP_LOOKUPS = [
  'https://ipwho.is/',
  'https://ipapi.co/json/',
] as const;

const NET_TIMEOUT_MS = 8000;

/**
 * Short, because it is no longer the only way through.
 *
 * When a satellite fix was mandatory this had to be generous, and a slow
 * radio still lost. Now that the network route is waiting behind it, a fix
 * that has not arrived in four seconds is simply not the fastest way to
 * answer, and falling through beats making someone watch a spinner.
 */
const FIX_TIMEOUT_MS = 4000;

async function getJson(url: string, timeoutMs = NET_TIMEOUT_MS): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;

    /*
     * Captive portals and ISP interception pages answer 200 with HTML.
     * Parsing that as JSON throws somewhere unhelpful, so the content type is
     * checked before the body is trusted — the same guard the API client uses.
     */
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return null;

    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** First finite number in a series, or null. Open-Meteo pads with nulls. */
function firstNumber(series: unknown): number | null {
  if (!Array.isArray(series)) return null;
  for (const v of series) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

const isCoord = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * A device position, but only if one is available without waiting on hardware.
 *
 * Returns null rather than throwing on every failure mode — denied, services
 * off, no cached fix, slow radio — because the caller has somewhere else to
 * go and none of these are worth surfacing as errors.
 */
async function deviceFix(): Promise<Fix | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    // Permission granted is not the same as location being switched on.
    if (!(await Location.hasServicesEnabledAsync())) return null;

    // A cached fix costs nothing and is plenty accurate for this.
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
    if (cached) {
      return { lat: cached.coords.latitude, lon: cached.coords.longitude, source: 'device' };
    }

    const live = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (!live) return null;

    return { lat: live.coords.latitude, lon: live.coords.longitude, source: 'device' };
  } catch {
    // Includes the case where the native module is missing entirely, which is
    // what happens in a build made before expo-location was added.
    return null;
  }
}

/**
 * City-level coordinates from the network. No permission, no hardware.
 *
 * Two providers, tried in order. The single provider this had before was
 * enough to make the whole card fail when it answered 403 — free IP services
 * reject unfamiliar user agents and rate-limit aggressively, so treating any
 * one of them as reliable was the mistake.
 *
 * An explicit Accept header goes out because that 403 is usually a service
 * guessing the caller is a scraper.
 */
async function networkFix(): Promise<Fix | null> {
  for (const url of IP_LOOKUPS) {
    const data = await getJson(url);
    // ipwho.is nests nothing; ipapi.co uses the same key names. Both also
    // report failure in-band with a 200, so success is checked explicitly.
    if (data && data.success === false) continue;

    const lat = data?.latitude;
    const lon = data?.longitude;
    if (isCoord(lat) && isCoord(lon)) return { lat, lon, source: 'network' };
  }
  return null;
}

export class OpenMeteoConditions implements ConditionsService {
  async current(): Promise<{ state: LocationState; data: Conditions | null; notice: string | null }> {
    /*
     * Three tiers, best first. The last one cannot fail, so the only way to
     * reach the notice below is for the weather service itself to be down.
     */
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

    // us_aqi is the 0–500 scale most people recognise; european_aqi is the
    // fallback, because Open-Meteo does not serve the US scale everywhere.
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
      data: { uvIndex, aqi, humidity, lat, lon, source: fix.source, place: fix.label ?? null },
      notice: null,
    };
  }
}
