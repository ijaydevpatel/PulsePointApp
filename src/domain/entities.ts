/**
 * Domain entities. This file imports NOTHING - no React, no SQLite, no network.
 * That constraint is requirement L2 and is enforced by lint rule in CI.
 */

export type TriageBand = 'SELF_CARE' | 'PHARMACY_GP' | 'URGENT' | 'EMERGENCY';

export const BAND_ORDER: readonly TriageBand[] = [
  'SELF_CARE', 'PHARMACY_GP', 'URGENT', 'EMERGENCY',
];

export type AgeBand = 'CHILD' | 'ADULT' | 'OLDER_ADULT';

/** A single reported symptom with its severity, 0..10. */
export interface Symptom {
  readonly code: string;
  readonly label: string;
  readonly severity: number;
}

/** One triage attempt by the user. FR1. */
export interface SymptomEpisode {
  readonly id: string;
  readonly capturedAt: string;
  readonly ageBand: AgeBand;
  readonly durationHours: number;
  readonly symptoms: readonly Symptom[];
}

export type ResultSource = 'ON_DEVICE_RULES' | 'ON_DEVICE_MODEL' | 'REMOTE';
export type SyncStatus = 'PENDING_SYNC' | 'SYNCED';

/** The output of triage. QR5 requires confidence to be carried, never hidden. */
export interface TriageResult {
  readonly episodeId: string;
  readonly band: TriageBand;
  readonly severity: number;          // 0..100
  readonly confidence: number;        // 0..1
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

/** Returns whichever band is more severe. Used so enrichment can escalate but never de-escalate. */
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
