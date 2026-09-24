/**
 * Health facilities from OpenStreetMap, via Overpass.
 *
 * The same source and the same query shape the website's map uses, so the app
 * and the site cannot disagree about what is nearby. Overpass is public and
 * keyless, which is why this talks to it directly rather than through our
 * backend: there is no secret to protect and no reason to add a hop that can
 * fail.
 *
 * ── Two endpoints ────────────────────────────────────────────────────────────
 *
 * overpass-api.de first, overpass.kumi.systems second - the website's order.
 * The public instances rate-limit and go down for maintenance independently,
 * and a map with nothing on it is indistinguishable from a neighbourhood with
 * no doctors in it. One mirror is not redundancy; it is a single point of
 * failure with extra steps.
 */
import {
  Facility, FacilityService, FacilitySearch, byDistance, classify, haversineKm,
  isOpen24h, isUrgent,
} from '../domain/facilities';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const;

/**
 * Half-width of the search box, in degrees.
 *
 * 0.06 is the website's figure - roughly 6.5km of latitude. A box rather than
 * a radius because that is what Overpass takes; the distances shown are true
 * great-circle values, so the corners are simply further away than the edges.
 */
const BBOX_DEGREES = 0.06;

/**
 * Generous, because this is one request that replaces a whole screen.
 *
 * Overpass is a shared public service and a busy instance can take twenty
 * seconds to answer a query this size. Cutting it off early only sends the
 * caller to the second endpoint, which is slower than waiting.
 */
const TIMEOUT_MS = 25000;

/** Overpass' own server-side limit, kept below the client's. */
const QUERY_TIMEOUT_S = 20;

/**
 * The query.
 *
 * Copied in substance from the website's, which is why it is this long: OSM
 * tags health places under `amenity`, `healthcare` and `shop` inconsistently,
 * and asking for only one of them silently loses whole categories. Pharmacies
 * are `amenity=pharmacy` in most of the world and `shop=chemist` in parts of
 * it; opticians are a shop; laboratories are `healthcare`.
 *
 * `out center` so ways and relations - a hospital is usually a building
 * outline rather than a point - come back with coordinates instead of a list
 * of nodes.
 */
function buildQuery(lat: number, lon: number): string {
  const s = (lat - BBOX_DEGREES).toFixed(5);
  const w = (lon - BBOX_DEGREES).toFixed(5);
  const n = (lat + BBOX_DEGREES).toFixed(5);
  const e = (lon + BBOX_DEGREES).toFixed(5);
  const bbox = `${s},${w},${n},${e}`;

  const amenities = [
    'hospital', 'clinic', 'doctors', 'dentist', 'pharmacy',
    'health_post', 'nursing_home', 'laboratory',
  ];
  const healthcare = [
    'hospital', 'clinic', 'doctor', 'centre', 'dentist', 'pharmacy',
    'laboratory', 'blood_bank', 'blood_donation', 'diagnostic',
    'sample_collection', 'radiology', 'optometrist', 'alternative',
    'urgent_care', 'emergency',
  ];
  const shops = ['chemist', 'optician', 'herbalist', 'nutrition_supplements'];

  const lines: string[] = [];
  for (const a of amenities) {
    lines.push(`node["amenity"="${a}"](${bbox});`);
    lines.push(`way["amenity"="${a}"](${bbox});`);
  }
  for (const h of healthcare) {
    lines.push(`node["healthcare"="${h}"](${bbox});`);
    lines.push(`way["healthcare"="${h}"](${bbox});`);
  }
  for (const sh of shops) {
    lines.push(`node["shop"="${sh}"](${bbox});`);
    lines.push(`way["shop"="${sh}"](${bbox});`);
  }
  lines.push(`relation["amenity"="hospital"](${bbox});`);

  return `[out:json][timeout:${QUERY_TIMEOUT_S}];(\n${lines.join('\n')}\n);out center;`;
}

/** Street address from whichever of the addr:* tags are present. */
function address(tags: Record<string, string | undefined>): string | null {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:suburb'] ?? tags['addr:city'],
  ].filter((p) => p && p.trim() !== '');

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * One Overpass element to a Facility, or null if it cannot be placed or named.
 *
 * Unnamed elements are dropped rather than shown as "Unnamed clinic". OSM is
 * full of half-entered places, and a row that says nothing is a row that
 * wastes a tap on a screen someone may be using in a hurry.
 */
export function toFacility(
  element: any, fromLat: number, fromLon: number,
): Facility | null {
  const tags = (element?.tags ?? {}) as Record<string, string | undefined>;

  const name = (tags.name ?? '').trim();
  if (!name) return null;

  const lat = typeof element?.lat === 'number' ? element.lat : element?.center?.lat;
  const lon = typeof element?.lon === 'number' ? element.lon : element?.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  return {
    id: `${element?.type ?? 'node'}/${element?.id ?? `${lat},${lon}`}`,
    name,
    kind: classify(tags),
    lat,
    lon,
    km: haversineKm(fromLat, fromLon, lat, lon),
    open24h: isOpen24h(tags),
    urgent: isUrgent(tags),
    phone: (tags.phone ?? tags['contact:phone'] ?? '').trim() || null,
    address: address(tags),
  };
}

/** The whole response, de-duplicated and ordered. */
export function readFacilities(
  body: any, fromLat: number, fromLon: number,
): readonly Facility[] {
  const elements = Array.isArray(body?.elements) ? body.elements : [];

  /*
   * A hospital is frequently mapped twice - once as the building outline and
   * once as a point inside it - and both come back. Keyed by name and rounded
   * position rather than by id, because the duplicates have different ids;
   * that is the whole reason they are duplicates rather than one element.
   */
  const seen = new Map<string, Facility>();

  for (const element of elements) {
    const f = toFacility(element, fromLat, fromLon);
    if (!f) continue;

    const key = `${f.name.toLowerCase()}@${f.lat.toFixed(3)},${f.lon.toFixed(3)}`;
    const existing = seen.get(key);

    // Keep whichever reading says more: a named kind beats OTHER.
    if (!existing || (existing.kind === 'OTHER' && f.kind !== 'OTHER')) {
      seen.set(key, f);
    }
  }

  return [...seen.values()].sort(byDistance);
}

export class OverpassFacilities implements FacilityService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async near(at: FacilitySearch): Promise<{
    facilities: readonly Facility[];
    notice: string | null;
  }> {
    const query = buildQuery(at.lat, at.lon);
    let lastNotice = 'Nothing could be loaded for this area.';

    for (const endpoint of ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: query,
          signal: controller.signal,
        });

        if (!response.ok) {
          // 429 and 504 are what a busy public instance answers with, and the
          // other mirror is usually fine. Worth the second request.
          lastNotice = `The map service is busy (HTTP ${response.status}).`;
          continue;
        }

        /*
         * Overpass answers HTML when it is rate-limiting or in maintenance,
         * and calling .json() on that throws somewhere unhelpful.
         */
        const type = response.headers?.get?.('content-type') ?? '';
        if (!type.includes('json')) {
          lastNotice = 'The map service is busy right now.';
          continue;
        }

        const facilities = readFacilities(await response.json(), at.lat, at.lon);
        return {
          facilities,
          notice: facilities.length === 0
            ? 'No health facilities are mapped within about 6 km.'
            : null,
        };
      } catch (error) {
        lastNotice = (error instanceof Error && error.name === 'AbortError')
          ? 'The map service did not respond in time.'
          : 'The map service could not be reached.';
      } finally {
        clearTimeout(timer);
      }
    }

    return { facilities: [], notice: lastNotice };
  }
}
