/**
 * Real environmental conditions for the device's location.
 *
 * ── Why this does not come from our own backend ──────────────────────────────
 *
 * `/api/dashboard/intel` returns `{ aqi: 38, uv: 5, humidity: 62 }` — the same
 * three numbers for every user, every request, marked "Static fallback" in the
 * route. The website renders them under "Environmental Pulse" as though they
 * were measurements. Porting that to the phone would mean shipping a fixed
 * number labelled as the air quality where someone is standing.
 *
 * Open-Meteo is used instead: free, no API key, no account, and no request
 * signing — so nothing secret has to be stored in the app to call it. Two
 * endpoints, because air quality and weather are separate products there.
 *
 * ── Failure is a state, not an exception ─────────────────────────────────────
 *
 * Every field is nullable and every failure path returns a notice rather than
 * throwing. A missing reading renders as "—". The one thing this must never do
 * is substitute a default: a humidity figure that is actually a fallback
 * constant is indistinguishable, on screen, from a measurement.
 */
import * as Location from 'expo-location';
import { Conditions, ConditionsService, LocationState } from '../domain/remote';

const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER = 'https://api.open-meteo.com/v1/forecast';

/** Beyond this a reading is not worth waiting for on a dashboard. */
const TIMEOUT_MS = 8000;

/**
 * A live fix gets longer than a network request.
 *
 * Nothing blocks on this — the rest of Home has already rendered — and 8s was
 * short enough that a cold radio lost the race even when it was about to
 * succeed.
 */
const FIX_TIMEOUT_MS = 15000;

async function getJson(url: string): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;

    /*
     * Captive portals and ISP interception pages answer 200 with HTML. Parsing
     * that as JSON throws somewhere unhelpful, so the content type is checked
     * before the body is trusted — the same guard the API client uses.
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

export class OpenMeteoConditions implements ConditionsService {
  async current(): Promise<{ state: LocationState; data: Conditions | null; notice: string | null }> {
    /*
     * Permission first. A refusal is an ordinary answer — the rest of the
     * dashboard is unaffected by it — so it returns a state rather than an
     * error, and the wording avoids implying the person did something wrong.
     */
    let granted = false;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      granted = status === Location.PermissionStatus.GRANTED;
    } catch {
      return {
        state: 'UNAVAILABLE',
        data: null,
        notice: 'Location is not available on this device.',
      };
    }

    if (!granted) {
      return {
        state: 'DENIED',
        data: null,
        notice: 'Allow location to see conditions where you are.',
      };
    }

    /*
     * Permission granted is not the same as location being on.
     *
     * Android keeps the app grant and the device-wide toggle separate, so a
     * user can have said yes to PulsePoint while Location itself is switched
     * off — or be on an emulator that has never had a position set. In that
     * state the cached fix is null and the live one never resolves, which is
     * precisely the stall this card was showing, under a message that blamed
     * the fix rather than the setting.
     *
     * Checking first means the notice can say the one thing that actually
     * helps.
     */
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        return {
          state: 'UNAVAILABLE',
          data: null,
          notice: 'Location is switched off on this device. Turn it on to see local conditions.',
        };
      }
    } catch {
      // Older platforms can throw here; fall through and let the fix decide.
    }

    /*
     * Last known position first, then a live fix.
     *
     * getCurrentPositionAsync waits for the radio to produce a reading. On an
     * emulator with no simulated route, and on a real phone indoors or
     * straight after boot, that can hang until it throws — which is what put
     * "Could not get a location fix just now" on the dashboard even with
     * permission granted.
     *
     * The cached fix is returned by the OS instantly and is easily precise
     * enough: this is a lookup for city-scale air quality, not navigation. A
     * live fix is only attempted when there is no cached one, and it is raced
     * against a timeout so a silent radio degrades to a notice rather than to
     * a card that spins forever.
     */
    let lat: number;
    let lon: number;
    try {
      const cached = await Location.getLastKnownPositionAsync({
        // Anything from the last hour is fine for weather and AQI.
        maxAge: 60 * 60 * 1000,
      });

      /*
       * Accuracy.Low, not Balanced.
       *
       * Balanced asks for a GPS-grade fix, which needs sky and can take tens
       * of seconds indoors. Low is satisfied by cell towers and wifi — it
       * resolves in a second or two, works inside a building, and is accurate
       * to a few hundred metres, which is far more than a city-scale air
       * quality lookup needs.
       */
      const pos = cached ?? await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ]);

      if (!pos) {
        return {
          state: 'UNAVAILABLE',
          data: null,
          notice: 'Could not get a position. Pull down to retry.',
        };
      }

      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      return {
        state: 'UNAVAILABLE',
        data: null,
        notice: 'Location is unavailable on this device.',
      };
    }

    const [air, weather] = await Promise.all([
      getJson(`${AIR}?latitude=${lat}&longitude=${lon}&hourly=european_aqi,us_aqi&timezone=auto&forecast_days=1`),
      getJson(`${WEATHER}?latitude=${lat}&longitude=${lon}&current=relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`),
    ]);

    // us_aqi is the 0–500 scale the website's "38" implies; european_aqi is
    // the fallback because Open-Meteo does not serve US AQI everywhere.
    const aqi = firstNumber(air?.hourly?.us_aqi) ?? firstNumber(air?.hourly?.european_aqi);
    const uvIndex = firstNumber(weather?.daily?.uv_index_max);
    const humidityRaw = weather?.current?.relative_humidity_2m;
    const humidity = typeof humidityRaw === 'number' && Number.isFinite(humidityRaw)
      ? humidityRaw
      : null;

    if (aqi === null && uvIndex === null && humidity === null) {
      return {
        state: 'UNAVAILABLE',
        data: null,
        notice: 'Conditions are unavailable right now.',
      };
    }

    return {
      state: 'OK',
      data: { uvIndex, aqi, humidity, lat, lon },
      notice: null,
    };
  }
}
