export type TriageBand = 'SELF_CARE' | 'PHARMACY_GP' | 'URGENT' | 'EMERGENCY';

export const BAND_ORDER: readonly TriageBand[] = [
  'SELF_CARE', 'PHARMACY_GP', 'URGENT', 'EMERGENCY',
];

export type AgeBand = 'CHILD' | 'ADULT' | 'OLDER_ADULT';

export interface Symptom {
  readonly code: string;
  readonly label: string;
  readonly severity: number;
}

export interface SymptomEpisode {
  readonly id: string;
  readonly capturedAt: string;
  readonly ageBand: AgeBand;
  readonly durationHours: number;
  readonly symptoms: readonly Symptom[];
}

export type ResultSource = 'ON_DEVICE_RULES' | 'ON_DEVICE_MODEL' | 'REMOTE';
export type SyncStatus = 'PENDING_SYNC' | 'SYNCED';

export interface TriageResult {
  readonly episodeId: string;
  readonly band: TriageBand;
  readonly severity: number;
  readonly confidence: number;
  readonly source: ResultSource;
  readonly redFlags: readonly string[];
  readonly rationale: readonly string[];
  readonly syncStatus: SyncStatus;
}

export function requiresEscalation(r: TriageResult): boolean {
  return r.band === 'URGENT' || r.band === 'EMERGENCY' || r.redFlags.length > 0;
}

export function bandRank(b: TriageBand): number {
  return BAND_ORDER.indexOf(b);
}

export function maxBand(a: TriageBand, b: TriageBand): TriageBand {
  return bandRank(a) >= bandRank(b) ? a : b;
}

export const BAND_LABEL: Record<TriageBand, string> = {
  SELF_CARE: 'Self-care at home',
  PHARMACY_GP: 'See a pharmacist or GP',
  URGENT: 'Urgent care, today',
  EMERGENCY: 'Emergency - call 111',
};

export const BAND_ADVICE: Record<TriageBand, string> = {
  SELF_CARE: 'Your symptoms suggest you can manage this at home. Seek advice if things get worse.',
  PHARMACY_GP: 'Book with your GP or speak to a pharmacist in the next day or two.',
  URGENT: 'Get seen today at an urgent care clinic or after-hours service.',
  EMERGENCY: 'Call 111 now, or go to your nearest emergency department.',
};
