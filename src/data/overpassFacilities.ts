/**
 * Health facilities from OpenStreetMap, via Overpass.
 *
 * The same source and the same query shape the website's map uses, so the app
 * and the site cannot disagree about what is nearby. Overpass is public and
 * keyless, which is why this talks to it directly rather than through our
 * backend: there is no secret to protect and no reason to add a hop that can
 * fail.
 *
 * ── Four endpoints ───────────────────────────────────────────────────────────
 *
 * overpass-api.de and overpass.kumi.systems are the website's pair, in the
 * website's order, and two more follow them. The public instances rate-limit
 * per IP and go down for maintenance independently, so a run of failures is
 * normal rather than exceptional - and a map with nothing on it is
 * indistinguishable from a neighbourhood with no doctors in it. One mirror is
 * not redundancy; it is a single point of failure with extra steps.
 *
 * The cost of a longer list is only paid when the earlier ones fail, because
 * the first answer wins and the rest are never called.
 */
import {
  Facility, FacilityResult, FacilityService, FacilitySearch, byDistance, classify,
  haversineKm, isOpen24h, isUrgent, KIND_LABEL,
} from '../domain/facilities';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
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
 * These are the website's figures, and the app's earlier ones - 20s on the
 * server, 25s on the client - are why the Map tab reported "did not respond in
 * time" on a query the website answers fine. A dense city centre takes Overpass
 * well over twenty seconds, and the server-side limit is the one that bites
 * first: it aborts the query and returns nothing, so the client timeout never
 * even gets a chance to be the problem.
 *
 * The client's is kept below the server's so a query that is genuinely going to
 * fail fails here rather than hanging.
 */
const TIMEOUT_MS = 40000;

/**
 * How long one mirror gets to itself before the next is started alongside it.
 *
 * Not "before it is given up on" - it keeps running, and whichever answers
 * first wins. Six seconds is long enough that a healthy mirror on a decent
 * connection is never hedged at all, and short enough that an unreachable one
 * does not decide how long the person waits.
 */
const HEDGE_MS = 6000;

/**
 * How long the whole attempt may take, across every mirror.
 *
 * With the mirrors hedged rather than queued they are all in flight within
 * twenty seconds, so this is a cap on the slowest useful answer rather than
 * the sum of four timeouts.
 */
const TOTAL_BUDGET_MS = 50000;

/** Overpass' own server-side limit, kept above the time a city centre needs. */
const QUERY_TIMEOUT_S = 45;

/**
 * The query.
 *
 * ── Five statements, not seventy ─────────────────────────────────────────────
 *
 * The website spells out every tag as its own node/way/relation line, which
 * runs to about seventy statements. This asks the same questions with `nwr`
 * (node, way and relation at once) and a regex over the values, which is both
 * shorter and strictly more complete: the website lists `healthcare` values
 * one by one and so silently misses any it did not think of, while
 * `nwr["healthcare"]` catches every one of them including values added to OSM
 * since.
 *
 * ── Why three tag keys ───────────────────────────────────────────────────────
 *
 * OSM files health places under `amenity`, `healthcare`, `shop` and `office`
 * inconsistently, and asking for one of them loses whole categories without
 * any sign that it has. Pharmacies are `amenity=pharmacy` in most of the world
 * and `shop=chemist` in parts of it; opticians and hearing-aid shops are a
 * `shop`; a GP practice is often `office=physician` and nothing else.
 *
 * ── What is deliberately absent ──────────────────────────────────────────────
 *
 * `amenity=veterinary`. The website includes vets; this screen is what someone
 * opens when they are unwell, and a vet is not somewhere to send them.
 *
 * `out center` so ways and relations - a hospital is usually a building outline
 * rather than a point - come back with coordinates instead of a list of nodes.
 */
function buildQuery(lat: number, lon: number): string {
  const s = (lat - BBOX_DEGREES).toFixed(5);
  const w = (lon - BBOX_DEGREES).toFixed(5);
  const n = (lat + BBOX_DEGREES).toFixed(5);
  const e = (lon + BBOX_DEGREES).toFixed(5);
  const bbox = `${s},${w},${n},${e}`;

  const amenity = [
    'hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'healthcare',
    'health_post', 'nursing_home', 'social_facility', 'laboratory',
  ].join('|');

  const shop = [
    'chemist', 'pharmacy', 'optician', 'hearing_aids', 'medical_supply',
    'herbalist', 'nutrition_supplements',
  ].join('|');

  const office = ['physician', 'healthcare', 'therapist'].join('|');

  const lines = [
    `nwr["amenity"~"^(${amenity})$"](${bbox});`,
    // Unfiltered on purpose - every healthcare=* value is a health facility.
    `nwr["healthcare"](${bbox});`,
    `nwr["healthcare:speciality"](${bbox});`,
    `nwr["shop"~"^(${shop})$"](${bbox});`,
    `nwr["office"~"^(${office})$"](${bbox});`,
  ];

  // `qt` orders by quadtile, which is the cheapest order for Overpass to
  // produce - it is the one the data is already in.
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];(\n${lines.join('\n')}\n);out center qt;`;
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
 * One Overpass element to a Facility, or null if it cannot be placed.
 *
 * ── Unnamed places are kept ──────────────────────────────────────────────────
 *
 * They used to be dropped, on the reasoning that a row saying nothing wastes a
 * tap. That reasoning was wrong for this screen: the question being asked is
 * "what health facilities are around me", and a pharmacy that nobody has
 * typed a name for is still a pharmacy, still open, and still where it is.
 * Dropping it removed a real place from a map of real places.
 *
 * So an unnamed element is labelled by its category - "Pharmacy", "Clinic" -
 * which is both true and the most useful thing that can be said about it. A
 * position, though, is not optional: an element that cannot be placed cannot
 * be shown on a map or measured a distance to.
 */
export function toFacility(
  element: any, fromLat: number, fromLon: number,
): Facility | null {
  const tags = (element?.tags ?? {}) as Record<string, string | undefined>;

  const lat = typeof element?.lat === 'number' ? element.lat : element?.center?.lat;
  const lon = typeof element?.lon === 'number' ? element.lon : element?.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const kind = classify(tags);

  // name:en after name, because an English-language UI showing a local-script
  // name it cannot render is worse than showing the English one OSM carries.
  const given = (tags.name ?? tags['name:en'] ?? '').trim();

  return {
    id: `${element?.type ?? 'node'}/${element?.id ?? `${lat},${lon}`}`,
    name: given || KIND_LABEL[kind],
    named: given !== '',
    kind,
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

    /*
     * Unnamed places are keyed by id instead. Their "name" is a category
     * label shared by every other unnamed place of that kind, so the
     * name-and-position key would collapse two different unnamed pharmacies
     * a hundred metres apart into one - inventing a duplicate rather than
     * finding one.
     */
    const key = f.named
      ? `${f.name.toLowerCase()}@${f.lat.toFixed(3)},${f.lon.toFixed(3)}`
      : f.id;
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

  async near(at: FacilitySearch): Promise<FacilityResult> {
    const query = buildQuery(at.lat, at.lon);
    const body = `data=${encodeURIComponent(query)}`;
    let lastNotice = 'Nothing could be loaded for this area.';

    /** One mirror. Resolves to a result, or null having recorded why not. */
    const ask = async (endpoint: string, signal: AbortSignal): Promise<FacilityResult | null> => {
      try {
        /*
         * Form-encoded, as the website sends it. Overpass accepts a raw body
         * too, but `data=` is the documented form and is what every mirror is
         * certain to handle identically.
         */
        const response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal,
        });

        if (!response.ok) {
          // 429 and 504 are what a busy public instance answers with.
          lastNotice = `The map service is busy (HTTP ${response.status}).`;
          return null;
        }

        /*
         * Overpass answers HTML when it is rate-limiting or in maintenance,
         * and calling .json() on that throws somewhere unhelpful.
         */
        const type = response.headers?.get?.('content-type') ?? '';
        if (!type.includes('json')) {
          lastNotice = 'The map service is busy right now.';
          return null;
        }

        const facilities = readFacilities(await response.json(), at.lat, at.lon);
        return {
          ok: true,
          facilities,
          notice: facilities.length === 0
            ? 'No health facilities are mapped within about 6 km.'
            : null,
        };
      } catch (error) {
        lastNotice = (error instanceof Error && error.name === 'AbortError')
          ? 'The map service did not respond in time.'
          : 'The map service could not be reached.';
        return null;
      }
    };

    /*
     * ── Hedged, not sequential ─────────────────────────────────────────────
     *
     * Asking one mirror and waiting the full timeout before trying the next
     * is fine on a fast connection and useless on a phone: the Map tab worked
     * on the emulator over laptop wifi and timed out on the handset, because
     * an endpoint the device cannot reach costs the *entire* per-attempt
     * budget before anything else is tried, and two of those exhausted the
     * whole deadline. Whether a mirror is slow or simply unreachable is not
     * knowable in advance, and waiting is the most expensive way to find out.
     *
     * So the next mirror is started if the previous has not answered within a
     * few seconds, rather than only once it has failed. The first good answer
     * wins and cancels the rest. A mirror that answers in two seconds still
     * costs exactly one request; the extra requests only happen when the
     * first one is already letting the person down.
     */
    return await new Promise<FacilityResult>((resolve) => {
      const controllers: AbortController[] = [];
      let started = 0;
      let outstanding = 0;
      let done = false;

      const finish = (r: FacilityResult) => {
        if (done) return;
        done = true;
        clearInterval(hedge);
        clearTimeout(deadline);
        // Losing requests are cancelled so they cannot hold the radio awake.
        for (const c of controllers) c.abort();
        resolve(r);
      };

      const giveUp = () => finish({ ok: false, facilities: [], notice: lastNotice });

      const startNext = () => {
        if (done || started >= ENDPOINTS.length) return;

        const endpoint = ENDPOINTS[started]!;
        started += 1;
        outstanding += 1;

        const controller = new AbortController();
        controllers.push(controller);
        const perAttempt = setTimeout(() => controller.abort(), TIMEOUT_MS);

        void ask(endpoint, controller.signal).then((r) => {
          clearTimeout(perAttempt);
          outstanding -= 1;

          if (r) return finish(r);
          // A failure is a reason to start the next one immediately rather
          // than waiting out the hedge interval.
          if (started < ENDPOINTS.length) return startNext();
          if (outstanding === 0) giveUp();
        });
      };

      const hedge = setInterval(() => {
        if (done || started >= ENDPOINTS.length) return clearInterval(hedge);
        startNext();
      }, HEDGE_MS);

      const deadline = setTimeout(giveUp, TOTAL_BUDGET_MS);

      startNext();
    });
  }
}
