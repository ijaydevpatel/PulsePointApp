/**
 * The Map tab's data.
 *
 * It shipped with four invented Auckland facilities behind a "Phase 6" notice.
 * On a screen whose entire job is to say where to go, sample data is worse
 * than an empty screen - indistinguishable from a working feature until
 * someone drives to a clinic that does not exist.
 *
 * These cover the parts that are decisions rather than transport: what counts
 * as which kind of place, what may be claimed about opening hours, and the
 * order the list comes back in. The map canvas is not tested here; it is a
 * native view, and none of the reasoning lives in it.
 */
import {
  classify, isUrgent, isOpen24h, haversineKm, byDistance, matches,
  Facility, KIND_LABEL,
} from '../src/domain/facilities';
import { toFacility, readFacilities, OverpassFacilities } from '../src/data/overpassFacilities';

const AT = { lat: -36.8485, lon: 174.7633 };   // Auckland, as it happens

const node = (id: number, tags: Record<string, string>, dLat = 0, dLon = 0) => ({
  type: 'node', id, lat: AT.lat + dLat, lon: AT.lon + dLon, tags,
});

describe('what counts as which kind of place', () => {
  it('reads the ordinary tags', () => {
    expect(classify({ amenity: 'pharmacy' })).toBe('PHARMACY');
    expect(classify({ amenity: 'dentist' })).toBe('DENTIST');
    expect(classify({ amenity: 'clinic' })).toBe('CLINIC');
    expect(classify({ amenity: 'doctors' })).toBe('CLINIC');
    expect(classify({ amenity: 'hospital' })).toBe('HOSPITAL');
    expect(classify({ healthcare: 'laboratory' })).toBe('LABORATORY');
  });

  it('finds the categories that are tagged as shops', () => {
    /*
     * The reason the Overpass query is as long as it is. OSM files opticians
     * and chemists under `shop`, so asking only for `amenity` and `healthcare`
     * loses two whole categories without any sign that it has.
     */
    expect(classify({ shop: 'optician' })).toBe('EYE_CARE');
    expect(classify({ shop: 'chemist' })).toBe('PHARMACY');
    expect(classify({ shop: 'herbalist' })).toBe('ALTERNATIVE');
    expect(classify({ healthcare: 'optometrist' })).toBe('EYE_CARE');
  });

  it('prefers the more consequential reading when tags overlap', () => {
    // Urgent care is usually also tagged as a clinic, and a hospital with an
    // emergency department is still a hospital. Show the one that matters.
    expect(classify({ amenity: 'clinic', healthcare: 'urgent_care' })).toBe('URGENT_CARE');
    expect(classify({ amenity: 'hospital', emergency: 'yes' })).toBe('URGENT_CARE');
    expect(classify({ amenity: 'hospital' })).toBe('HOSPITAL');
  });

  it('falls back rather than guessing', () => {
    expect(classify({ healthcare: 'something_new' })).toBe('OTHER');
    expect(classify({})).toBe('OTHER');
  });

  it('has a label for every kind', () => {
    for (const kind of Object.keys(KIND_LABEL)) {
      expect(KIND_LABEL[kind as keyof typeof KIND_LABEL].length).toBeGreaterThan(0);
    }
  });
});

describe('urgent care', () => {
  it('trusts the tags first', () => {
    expect(isUrgent({ healthcare: 'urgent_care' })).toBe(true);
    expect(isUrgent({ healthcare: 'emergency' })).toBe(true);
    expect(isUrgent({ amenity: 'hospital', emergency: 'yes' })).toBe(true);
  });

  it('reads a name only when it says so in whole words', () => {
    expect(isUrgent({ name: 'City Urgent Care' })).toBe(true);
    expect(isUrgent({ name: 'Accident and Emergency' })).toBe(true);
    expect(isUrgent({ name: 'Auckland A&E' })).toBe(true);

    /*
     * The reason the name check is a phrase match rather than a word one.
     * "Emergency" appears in the names of plenty of places that are not
     * emergency departments, and sending someone to a dental supplies shop at
     * 3am is the failure this guards against.
     */
    expect(isUrgent({ name: 'Emergency Dental Supplies' })).toBe(false);
    expect(isUrgent({ name: 'Urgently Good Pharmacy' })).toBe(false);
    expect(isUrgent({ name: 'Care Chemist' })).toBe(false);
  });
});

describe('opening hours', () => {
  it('claims 24 hours only when OSM says exactly that', () => {
    expect(isOpen24h({ opening_hours: '24/7' })).toBe(true);
    expect(isOpen24h({ opening_hours: ' 24/7 ' })).toBe(true);
  });

  it('says nothing about anything else', () => {
    /*
     * opening_hours is a small language with holidays and seasonal rules. A
     * naive parse would be wrong at exactly the hours this screen gets opened,
     * so anything that is not the round-the-clock value is simply not a claim.
     */
    expect(isOpen24h({ opening_hours: 'Mo-Fr 08:00-18:00' })).toBe(false);
    expect(isOpen24h({ opening_hours: 'Mo-Su 00:00-24:00' })).toBe(false);
    expect(isOpen24h({})).toBe(false);
  });
});

describe('distance', () => {
  it('measures a known separation', () => {
    // Auckland to Wellington is about 493km great-circle.
    expect(haversineKm(-36.8485, 174.7633, -41.2866, 174.7756)).toBeCloseTo(493, -1);
  });

  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(AT.lat, AT.lon, AT.lat, AT.lon)).toBeCloseTo(0, 6);
    expect(haversineKm(1, 2, 3, 4)).toBeCloseTo(haversineKm(3, 4, 1, 2), 9);
  });

  it('orders nearest first, then by name for a tie', () => {
    const f = (name: string, km: number): Facility => ({
      id: name, name, kind: 'CLINIC', lat: 0, lon: 0, km,
      open24h: false, urgent: false, phone: null, address: null,
    });
    const sorted = [f('Beta', 2), f('Alpha', 2), f('Near', 0.5)].sort(byDistance);
    expect(sorted.map((x) => x.name)).toEqual(['Near', 'Alpha', 'Beta']);
  });
});

describe('reading an Overpass response', () => {
  it('places a way from its centre, not its nodes', () => {
    // Hospitals are mapped as building outlines, so they arrive as ways with
    // a computed centre rather than a lat/lon of their own.
    const way = { type: 'way', id: 7, center: { lat: AT.lat, lon: AT.lon }, tags: { amenity: 'hospital', name: 'City Hospital' } };
    const f = toFacility(way, AT.lat, AT.lon)!;

    expect(f.name).toBe('City Hospital');
    expect(f.kind).toBe('HOSPITAL');
    expect(f.km).toBeCloseTo(0, 5);
  });

  it('drops what it cannot name or place', () => {
    // OSM is full of half-entered places. A row that says nothing wastes a tap
    // on a screen someone may be using in a hurry.
    expect(toFacility(node(1, { amenity: 'clinic' }), AT.lat, AT.lon)).toBeNull();
    expect(toFacility({ type: 'way', id: 2, tags: { name: 'No position' } }, AT.lat, AT.lon)).toBeNull();
  });

  it('collapses the same place mapped twice', () => {
    /*
     * A hospital is frequently mapped as both an outline and a point inside
     * it, and both come back with different ids - which is why the key is the
     * name and position rather than the id.
     */
    const list = readFacilities({
      elements: [
        node(1, { amenity: 'hospital', name: 'City Hospital' }),
        { type: 'way', id: 2, center: { lat: AT.lat, lon: AT.lon }, tags: { name: 'City Hospital', amenity: 'hospital' } },
      ],
    }, AT.lat, AT.lon);

    expect(list).toHaveLength(1);
  });

  it('keeps the more specific reading of a duplicate', () => {
    const list = readFacilities({
      elements: [
        node(1, { name: 'Ridge Health', office: 'yes' }),
        node(2, { name: 'Ridge Health', amenity: 'clinic' }),
      ],
    }, AT.lat, AT.lon);

    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe('CLINIC');
  });

  it('returns them nearest first', () => {
    const list = readFacilities({
      elements: [
        node(1, { amenity: 'pharmacy', name: 'Far' }, 0.02),
        node(2, { amenity: 'pharmacy', name: 'Near' }, 0.001),
      ],
    }, AT.lat, AT.lon);

    expect(list.map((f) => f.name)).toEqual(['Near', 'Far']);
  });

  it('survives a response that is not what it expects', () => {
    expect(readFacilities({}, AT.lat, AT.lon)).toEqual([]);
    expect(readFacilities({ elements: 'nonsense' }, AT.lat, AT.lon)).toEqual([]);
    expect(readFacilities(null, AT.lat, AT.lon)).toEqual([]);
  });
});

describe('when Overpass will not answer', () => {
  const ok = (body: unknown) => ({
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });

  it('tries the second mirror before giving up', async () => {
    /*
     * One mirror is not redundancy. The public instances rate-limit and go
     * down independently, and an empty map is indistinguishable from a
     * neighbourhood with no doctors in it.
     */
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (calls.length === 1) return { ok: false, status: 429, headers: { get: () => 'text/html' } };
      return ok({ elements: [node(1, { amenity: 'pharmacy', name: 'Unichem' })] });
    }) as any;

    const r = await new OverpassFacilities(fetchImpl).near(AT);

    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toBe(calls[1]);
    expect(r.facilities).toHaveLength(1);
    expect(r.notice).toBeNull();
  });

  it('reports a failure rather than an empty neighbourhood', async () => {
    const fetchImpl = (async () => { throw new Error('Network request failed'); }) as any;
    const r = await new OverpassFacilities(fetchImpl).near(AT);

    expect(r.facilities).toEqual([]);
    expect(r.notice).toMatch(/could not be reached/i);
  });

  it('distinguishes "nothing here" from "nothing came back"', async () => {
    // Both render as an empty list, so the notice is the only thing telling
    // the reader which of the two they are looking at.
    const fetchImpl = (async () => ok({ elements: [] })) as any;
    const r = await new OverpassFacilities(fetchImpl).near(AT);

    expect(r.facilities).toEqual([]);
    expect(r.notice).toMatch(/no health facilities are mapped/i);
  });

  it('does not try to parse an HTML rate-limit page', async () => {
    const fetchImpl = (async () => ({
      ok: true, status: 200,
      headers: { get: () => 'text/html' },
      json: async () => { throw new Error('Unexpected token <'); },
    })) as any;

    const r = await new OverpassFacilities(fetchImpl).near(AT);
    expect(r.notice).toMatch(/busy/i);
  });
});

describe('the filter', () => {
  const f: Facility = {
    id: 'x', name: 'Symonds Street Dental', kind: 'DENTIST',
    lat: 0, lon: 0, km: 0.3, open24h: false, urgent: false, phone: null, address: null,
  };

  it('matches a name or a category, case-insensitively', () => {
    expect(matches(f, 'symonds')).toBe(true);
    expect(matches(f, 'DENTAL')).toBe(true);
    expect(matches(f, 'pharmacy')).toBe(false);
  });

  it('keeps everything when empty', () => {
    expect(matches(f, '')).toBe(true);
    expect(matches(f, '   ')).toBe(true);
  });
});
