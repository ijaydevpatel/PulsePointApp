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

const BBOX_DEGREES = 0.06;

const TIMEOUT_MS = 40000;

function budgetFor(deg: number) {
  const small = deg <= 0.02;
  const mid = deg <= 0.04;
  return {
    serverSeconds: small ? 12 : mid ? 25 : 45,
    attemptMs: small ? 9000 : mid ? 18000 : TIMEOUT_MS,
    hedgeMs: small ? 0 : 4000,
    totalMs: small ? 14000 : mid ? 26000 : 50000,
  };
}




function buildQuery(lat: number, lon: number, deg: number = BBOX_DEGREES): string {
  const s = (lat - deg).toFixed(5);
  const w = (lon - deg).toFixed(5);
  const n = (lat + deg).toFixed(5);
  const e = (lon + deg).toFixed(5);
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

    `nwr["healthcare"](${bbox});`,
    `nwr["shop"~"^(${shop})$"](${bbox});`,
    `nwr["office"~"^(${office})$"](${bbox});`,
  ];

  return `[out:json][timeout:${budgetFor(deg).serverSeconds}];(\n${lines.join('\n')}\n);out center qt;`;
}

function address(tags: Record<string, string | undefined>): string | null {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:suburb'] ?? tags['addr:city'],
  ].filter((p) => p && p.trim() !== '');

  return parts.length > 0 ? parts.join(', ') : null;
}

export function toFacility(
  element: any, fromLat: number, fromLon: number,
): Facility | null {
  const tags = (element?.tags ?? {}) as Record<string, string | undefined>;

  const lat = typeof element?.lat === 'number' ? element.lat : element?.center?.lat;
  const lon = typeof element?.lon === 'number' ? element.lon : element?.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const kind = classify(tags);

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

export function readFacilities(
  body: any, fromLat: number, fromLon: number,
): readonly Facility[] {
  const elements = Array.isArray(body?.elements) ? body.elements : [];

  const seen = new Map<string, Facility>();

  for (const element of elements) {
    const f = toFacility(element, fromLat, fromLon);
    if (!f) continue;

    const key = f.named
      ? `${f.name.toLowerCase()}@${f.lat.toFixed(3)},${f.lon.toFixed(3)}`
      : f.id;
    const existing = seen.get(key);

    if (!existing || (existing.kind === 'OTHER' && f.kind !== 'OTHER')) {
      seen.set(key, f);
    }
  }

  return [...seen.values()].sort(byDistance);
}

export class OverpassFacilities implements FacilityService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async near(at: FacilitySearch): Promise<FacilityResult> {
    const deg = at.radiusDeg ?? BBOX_DEGREES;
    const budget = budgetFor(deg);
    const query = buildQuery(at.lat, at.lon, deg);
    const body = `data=${encodeURIComponent(query)}`;
    let lastNotice = 'Nothing could be loaded for this area.';

    const log: string[] = [];
    const note = (line: string) => { if (log.length < 6) log.push(line); };

    const ask = async (endpoint: string, signal: AbortSignal): Promise<FacilityResult | null> => {
      const host = endpoint.replace(/^https?:\/\//, '').split('/')[0] ?? endpoint;
      const started = Date.now();
      const secs = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

      try {
        const response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'PulsePoint/0.1 (health facility finder)',
          },
          body,
          signal,
        });

        if (!response.ok) {
          note(`${host}: HTTP ${response.status} after ${secs()}`);
          lastNotice = `The map service is busy (HTTP ${response.status}).`;
          return null;
        }

        const type = response.headers?.get?.('content-type') ?? '';
        if (!type.includes('json')) {
          note(`${host}: not JSON after ${secs()}`);
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
          diagnostics: null,
        };
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        const why = aborted
          ? `timed out at ${secs()}`
          : `${error instanceof Error ? error.message : 'failed'} at ${secs()}`;
        note(`${host}: ${why}`);

        lastNotice = aborted
          ? 'The map service did not respond in time.'
          : 'The map service could not be reached.';
        return null;
      }
    };

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

        for (const c of controllers) c.abort();
        resolve(r);
      };

      const giveUp = () => finish({
        ok: false,
        facilities: [],
        notice: lastNotice,
        diagnostics: log.length ? log.join('\n') : null,
      });

      const startNext = () => {
        if (done || started >= ENDPOINTS.length) return;

        const endpoint = ENDPOINTS[started]!;
        started += 1;
        outstanding += 1;

        const controller = new AbortController();
        controllers.push(controller);
        const perAttempt = setTimeout(() => controller.abort(), budget.attemptMs);

        void ask(endpoint, controller.signal).then((r) => {
          clearTimeout(perAttempt);
          outstanding -= 1;

          if (r) return finish(r);

          if (started < ENDPOINTS.length) return startNext();
          if (outstanding === 0) giveUp();
        });
      };

      const hedge = setInterval(() => {
        if (done || started >= ENDPOINTS.length) return clearInterval(hedge);
        startNext();
      }, Math.max(budget.hedgeMs, 50));

      if (budget.hedgeMs === 0) {
        while (started < ENDPOINTS.length) startNext();
      }

      const deadline = setTimeout(giveUp, budget.totalMs);

      startNext();
    });
  }
}
