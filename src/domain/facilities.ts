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

  readonly named: boolean;
  readonly kind: FacilityKind;
  readonly lat: number;
  readonly lon: number;

  readonly km: number;

  readonly open24h: boolean;

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

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Tags = Record<string, string | undefined>;

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

export function isOpen24h(tags: Tags): boolean {
  const hours = (tags.opening_hours ?? '').trim().toLowerCase();
  return hours === '24/7';
}

export function byDistance(a: Facility, b: Facility): number {
  if (a.km !== b.km) return a.km - b.km;
  return a.name.localeCompare(b.name);
}

export function matches(f: Facility, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return f.name.toLowerCase().includes(q)
    || KIND_LABEL[f.kind].toLowerCase().includes(q);
}

export interface FacilitySearch {
  readonly lat: number;
  readonly lon: number;

  readonly radiusDeg?: number;
}

export interface FacilityResult {
  readonly ok: boolean;
  readonly facilities: readonly Facility[];
  readonly notice: string | null;
}

export interface FacilityService {
  near(at: FacilitySearch): Promise<FacilityResult>;
}
