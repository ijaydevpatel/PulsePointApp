/**
 * Health facilities near a location.
 *
 * ── Where these come from ────────────────────────────────────────────────────
 *
 * OpenStreetMap, via the Overpass API - the same source the website's map uses,
 * queried the same way, so the two cannot disagree about what is nearby. This
 * file holds only the parts that are decisions rather than transport: what
 * counts as a health facility, which category it belongs to, whether it is open
 * around the clock, and how the list is ordered.
 *
 * The Map tab shipped with four invented Auckland facilities behind a "Phase 6"
 * notice. Sample data on a screen whose whole job is to tell someone where to
 * go is worse than an empty screen, because it is indistinguishable from a
 * working feature.
 *
 * ── What is never inferred ───────────────────────────────────────────────────
 *
 * Every flag below is read from a tag that is actually present. An untagged
 * facility is reported as unknown, not as closed and not as open. "Open now" is
 * deliberately absent: OSM opening_hours is a small language with holidays and
 * seasonal rules, and a naive parse of it would be wrong at exactly the hours
 * someone needs it most - late at night, on a public holiday.
 */

export type FacilityKind =
  | 'HOSPITAL'
  | 'URGENT_CARE'
  | 'CLINIC'
  | 'DENTIST'
  | 'PHARMACY'
  | 'EYE_CARE'
  | 'LABORATORY'
  | 'THERAPY'
  | 'CARE_HOME'
  | 'SUPPLIES'
  | 'ALTERNATIVE'
  | 'OTHER';

export interface Facility {
  readonly id: string;
  readonly name: string;
  /**
   * False when `name` is a category label standing in for a missing OSM name.
   * The UI needs to know the difference; the de-duplicator needs it more.
   */
  readonly named: boolean;
  readonly kind: FacilityKind;
  readonly lat: number;
  readonly lon: number;
  /** Straight-line kilometres from the person. Not travel distance. */
  readonly km: number;
  /** True only when OSM says 24/7. Absent tag means false, never "closed". */
  readonly open24h: boolean;
  /** Emergency department or urgent care, per its tags. */
  readonly urgent: boolean;
  readonly phone: string | null;
  readonly address: string | null;
}

export const KIND_LABEL: Record<FacilityKind, string> = {
  HOSPITAL: 'Hospital',
  URGENT_CARE: 'Urgent care',
  CLINIC: 'Clinic',
  DENTIST: 'Dental',
  PHARMACY: 'Pharmacy',
  EYE_CARE: 'Eye care',
  LABORATORY: 'Laboratory',
  THERAPY: 'Therapy',
  CARE_HOME: 'Care home',
  SUPPLIES: 'Medical supplies',
  ALTERNATIVE: 'Alternative medicine',
  OTHER: 'Health service',
};

/* ─────────────────────────────── distance ───────────────────────────────── */

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * Straight line, and the UI says so rather than implying a walking route. A
 * facility 300m away across a motorway is not 300m away, and pretending
 * otherwise on a screen about reaching care would be the wrong kind of wrong.
 */
export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ────────────────────────────── classifying ─────────────────────────────── */

type Tags = Record<string, string | undefined>;

/**
 * Which kind of place this is, from its tags.
 *
 * Order matters and is not alphabetical: urgent care is checked before the
 * clinic it is also tagged as, and hospital before both, because the most
 * consequential reading of an ambiguous place is the one to show.
 */
export function classify(tags: Tags): FacilityKind {
  const amenity = (tags.amenity ?? '').toLowerCase();
  const healthcare = (tags.healthcare ?? '').toLowerCase();
  const speciality = (tags['healthcare:speciality'] ?? '').toLowerCase();
  const shop = (tags.shop ?? '').toLowerCase();
  const office = (tags.office ?? '').toLowerCase();

  if (isUrgent(tags)) return 'URGENT_CARE';
  if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';

  if (amenity === 'pharmacy' || healthcare === 'pharmacy' || shop === 'chemist') return 'PHARMACY';
  if (amenity === 'dentist' || healthcare === 'dentist') return 'DENTIST';

  if (
    shop === 'optician'
    || healthcare === 'optometrist'
    || speciality.includes('ophthalmology')
    || speciality.includes('optometry')
  ) return 'EYE_CARE';

  if (
    healthcare === 'laboratory'
    || healthcare === 'blood_bank'
    || healthcare === 'blood_donation'
    || healthcare === 'diagnostic'
    || healthcare === 'sample_collection'
    || healthcare === 'radiology'
    || healthcare === 'mri'
    || healthcare === 'scanning'
    || amenity === 'laboratory'
    || speciality.includes('radiology')
  ) return 'LABORATORY';

  if (
    healthcare === 'physiotherapist'
    || healthcare === 'rehabilitation'
    || healthcare === 'psychotherapist'
    || healthcare === 'occupational_therapist'
    || healthcare === 'speech_therapist'
    || healthcare === 'podiatrist'
    || office === 'therapist'
  ) return 'THERAPY';

  // A care home is somewhere people live, not somewhere to turn up unwell -
  // worth showing and worth not calling a clinic.
  if (
    amenity === 'nursing_home'
    || amenity === 'social_facility'
    || healthcare === 'nursing_home'
  ) return 'CARE_HOME';

  if (shop === 'medical_supply' || shop === 'hearing_aids') return 'SUPPLIES';

  if (
    healthcare === 'alternative'
    || speciality.includes('naturopathy')
    || speciality.includes('homeopathy')
    || speciality.includes('acupuncture')
    || shop === 'herbalist'
    || shop === 'nutrition_supplements'
  ) return 'ALTERNATIVE';

  if (
    amenity === 'clinic' || amenity === 'doctors' || amenity === 'health_post'
    || amenity === 'healthcare'
    || healthcare === 'clinic' || healthcare === 'doctor'
    || healthcare === 'centre' || healthcare === 'center'
    || healthcare === 'midwife' || healthcare === 'nurse'
    || healthcare === 'yes'
    || office === 'physician' || office === 'healthcare'
  ) return 'CLINIC';

  return 'OTHER';
}

/**
 * Emergency or urgent care, per the tags only.
 *
 * The name check is last and narrow. It exists because "urgent care" is often
 * only in the name on smaller clinics, and missing one is a worse error here
 * than including one - but it matches whole phrases rather than the word
 * "emergency" anywhere, so an "Emergency Dental Supplies" shop does not become
 * an emergency department.
 */
export function isUrgent(tags: Tags): boolean {
  const healthcare = (tags.healthcare ?? '').toLowerCase();
  const emergency = (tags.emergency ?? '').toLowerCase();
  const amenity = (tags.amenity ?? '').toLowerCase();
  const name = (tags.name ?? '').toLowerCase();

  if (healthcare === 'urgent_care' || healthcare === 'emergency') return true;
  if (amenity === 'hospital' && emergency === 'yes') return true;

  return /\burgent care\b|\baccident (and|&) emergency\b|\ba ?& ?e\b|\bemergency department\b/
    .test(name);
}

/** True only for the explicit OSM round-the-clock value. */
export function isOpen24h(tags: Tags): boolean {
  const hours = (tags.opening_hours ?? '').trim().toLowerCase();
  return hours === '24/7';
}

/* ──────────────────────────────── ordering ──────────────────────────────── */

/**
 * Nearest first, and nothing cleverer.
 *
 * An earlier version of this screen ranked by triage band, which sounds
 * helpful and means the nearest pharmacy can sit below a hospital eight
 * kilometres away. Someone opening a map wants to know what is close; the
 * urgent and 24-hour flags are on the rows, so the ones that matter announce
 * themselves without being reordered.
 */
export function byDistance(a: Facility, b: Facility): number {
  if (a.km !== b.km) return a.km - b.km;
  return a.name.localeCompare(b.name);
}

/** Free-text filter over name and category, as the website's search does. */
export function matches(f: Facility, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return f.name.toLowerCase().includes(q)
    || KIND_LABEL[f.kind].toLowerCase().includes(q);
}

/* ──────────────────────────────── the port ──────────────────────────────── */

export interface FacilitySearch {
  readonly lat: number;
  readonly lon: number;
  /**
   * Half-width of the search box in degrees, when the caller wants a smaller
   * one than the default.
   *
   * This exists so a screen can narrow the search rather than give up. The
   * query is cheap over a quiet suburb and expensive over a dense city, and
   * the difference is the difference between an answer and a timeout.
   */
  readonly radiusDeg?: number;
}

export interface FacilityResult {
  /**
   * Whether an answer was actually received.
   *
   * The distinction the UI needs and cannot recover from the other two fields:
   * "nowhere near here has been mapped" and "nothing could be reached" are
   * both an empty list with a notice, and only one of them is a reason to
   * throw away a list already on screen.
   */
  readonly ok: boolean;
  readonly facilities: readonly Facility[];
  readonly notice: string | null;
}

export interface FacilityService {
  /** Never throws: an unreachable Overpass resolves to ok: false plus a notice. */
  near(at: FacilitySearch): Promise<FacilityResult>;
}
