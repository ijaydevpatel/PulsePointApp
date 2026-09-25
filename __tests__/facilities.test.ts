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

  it('reads the categories the wider query now returns', () => {
    /*
     * The query was widened to `nwr["healthcare"]` with no value filter, plus
     * office and shop keys, so values that used to be unreachable now arrive.
     * Left unclassified they would all land in OTHER, which is a grey pin and
     * the label "Health service" - true, and useless.
     */
    expect(classify({ healthcare: 'physiotherapist' })).toBe('THERAPY');
    expect(classify({ healthcare: 'psychotherapist' })).toBe('THERAPY');
    expect(classify({ healthcare: 'rehabilitation' })).toBe('THERAPY');
    expect(classify({ office: 'therapist' })).toBe('THERAPY');

    expect(classify({ amenity: 'nursing_home' })).toBe('CARE_HOME');
    expect(classify({ amenity: 'social_facility' })).toBe('CARE_HOME');

    expect(classify({ shop: 'medical_supply' })).toBe('SUPPLIES');
    expect(classify({ shop: 'hearing_aids' })).toBe('SUPPLIES');

    expect(classify({ healthcare: 'mri' })).toBe('LABORATORY');
    expect(classify({ healthcare: 'scanning' })).toBe('LABORATORY');

    // A GP practice is frequently tagged as an office and nothing else.
    expect(classify({ office: 'physician' })).toBe('CLINIC');
    expect(classify({ healthcare: 'yes' })).toBe('CLINIC');
    expect(classify({ healthcare: 'midwife' })).toBe('CLINIC');
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
      id: name, name, named: true, kind: 'CLINIC', lat: 0, lon: 0, km,
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

  it('drops only what it cannot place', () => {
    // A position is the one thing that cannot be substituted: an element with
    // no coordinates cannot be put on a map or measured a distance to.
    expect(toFacility({ type: 'way', id: 2, tags: { name: 'No position' } }, AT.lat, AT.lon)).toBeNull();
  });

  it('keeps an unnamed place under its category', () => {
    /*
     * These used to be dropped. That removed real places from a map of real
     * places - a pharmacy nobody has typed a name for is still a pharmacy,
     * still open, and still where it is.
     */
    const f = toFacility(node(1, { amenity: 'pharmacy' }), AT.lat, AT.lon)!;

    expect(f).not.toBeNull();
    expect(f.kind).toBe('PHARMACY');
    expect(f.name).toBe(KIND_LABEL.PHARMACY);
    expect(f.named).toBe(false);
  });

  it('marks a real name as real', () => {
    const f = toFacility(node(1, { amenity: 'pharmacy', name: 'Unichem' }), AT.lat, AT.lon)!;
    expect(f.named).toBe(true);
    expect(f.name).toBe('Unichem');
  });

  it('falls back to name:en rather than to the category', () => {
    const f = toFacility(node(1, { amenity: 'clinic', 'name:en': 'Harbour Clinic' }), AT.lat, AT.lon)!;
    expect(f.name).toBe('Harbour Clinic');
    expect(f.named).toBe(true);
  });

  it('does not merge two different unnamed places of the same kind', () => {
    /*
     * The de-duplication key is name plus rounded position, and every unnamed
     * pharmacy shares the same stand-in name. Keyed that way, two real
     * pharmacies a hundred metres apart would collapse into one - inventing a
     * duplicate rather than finding one.
     */
    const list = readFacilities({
      elements: [
        node(1, { amenity: 'pharmacy' }, 0.0002),
        node(2, { amenity: 'pharmacy' }, 0.0004),
      ],
    }, AT.lat, AT.lon);

    expect(list).toHaveLength(2);
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

  it('asks for enough server time to answer a city centre', async () => {
    /*
     * This is the bug the Map tab shipped with. The query carried
     * `[out:json][timeout:20]`, and a dense city centre takes Overpass well
     * over twenty seconds - so the *server* aborted, returned nothing, and the
     * screen reported "did not respond in time" for a query the website
     * answers fine. The website asks for 45 and gets an answer.
     */
    let sent = '';
    const fetchImpl = (async (_url: string, init: any) => {
      sent = String(init.body);
      return ok({ elements: [] });
    }) as any;

    await new OverpassFacilities(fetchImpl).near(AT);

    const query = decodeURIComponent(sent.replace(/^data=/, ''));
    const declared = Number(/\[timeout:(\d+)\]/.exec(query)?.[1]);

    expect(declared).toBeGreaterThanOrEqual(45);
  });

  it('sends the query form-encoded, as every mirror expects', async () => {
    let init: any = null;
    const fetchImpl = (async (_url: string, i: any) => { init = i; return ok({ elements: [] }); }) as any;

    await new OverpassFacilities(fetchImpl).near(AT);

    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(String(init.body).startsWith('data=')).toBe(true);
  });

  it('asks for the tags that carry health places', async () => {
    // Each of these is a whole category that vanishes from the map if the
    // query stops asking for it, with nothing on screen to say so.
    let sent = '';
    const fetchImpl = (async (_url: string, init: any) => {
      sent = decodeURIComponent(String(init.body).replace(/^data=/, ''));
      return ok({ elements: [] });
    }) as any;

    await new OverpassFacilities(fetchImpl).near(AT);

    for (const key of ['"amenity"', '"healthcare"', '"shop"', '"office"']) {
      expect(sent).toContain(key);
    }
    // node, way and relation at once - a hospital is usually a building
    // outline, not a point.
    expect(sent).toContain('nwr[');
    expect(sent).toContain('out center;');
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
    id: 'x', name: 'Symonds Street Dental', named: true, kind: 'DENTIST',
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
