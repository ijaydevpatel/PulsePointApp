/**
 * FR3 / QR5 — red-flag detection.
 *
 * These rules run BEFORE any scored classification and can never be suppressed
 * by low model confidence. They are deliberately deterministic and readable so
 * they can be reviewed against published triage guidance line by line.
 *
 * NOTE: placeholder rule set for Phase 1. Before Milestone 2 each rule must be
 * traced to a citable source (e.g. NZ Health / HealthPathways red-flag criteria).
 */
import { SymptomEpisode, TriageBand } from './entities';

export interface RedFlagRule {
  readonly id: string;
  readonly description: string;
  readonly band: TriageBand;
  readonly matches: (e: SymptomEpisode) => boolean;
}

const has = (e: SymptomEpisode, code: string) => e.symptoms.some((s) => s.code === code);
const sev = (e: SymptomEpisode, code: string) =>
  e.symptoms.find((s) => s.code === code)?.severity ?? 0;

export const RED_FLAG_RULES: readonly RedFlagRule[] = [
  {
    id: 'RF-CARDIAC',
    description: 'Chest pain with breathlessness or radiating arm/jaw pain',
    band: 'EMERGENCY',
    matches: (e) => has(e, 'chest_pain') && (has(e, 'breathlessness') || has(e, 'radiating_pain')),
  },
  {
    id: 'RF-STROKE',
    description: 'Facial droop, arm weakness or sudden speech difficulty',
    band: 'EMERGENCY',
    matches: (e) => has(e, 'facial_droop') || has(e, 'arm_weakness') || has(e, 'speech_difficulty'),
  },
  {
    id: 'RF-SEPSIS',
    description: 'High fever with confusion or non-blanching rash',
    band: 'EMERGENCY',
    matches: (e) => sev(e, 'fever') >= 7 && (has(e, 'confusion') || has(e, 'rash_non_blanching')),
  },
  {
    id: 'RF-BREATHING',
    description: 'Severe breathing difficulty',
    band: 'EMERGENCY',
    matches: (e) => sev(e, 'breathlessness') >= 8,
  },
  {
    id: 'RF-MENINGITIS',
    description: 'Severe headache with neck stiffness or light sensitivity',
    band: 'URGENT',
    matches: (e) => sev(e, 'headache') >= 7 && (has(e, 'neck_stiffness') || has(e, 'photophobia')),
  },
  {
    id: 'RF-DEHYDRATION-CHILD',
    description: 'Child with prolonged vomiting',
    band: 'URGENT',
    matches: (e) => e.ageBand === 'CHILD' && has(e, 'vomiting') && e.durationHours >= 24,
  },
  {
    id: 'RF-OLDER-FEVER',
    description: 'Older adult with sustained fever',
    band: 'URGENT',
    matches: (e) => e.ageBand === 'OLDER_ADULT' && sev(e, 'fever') >= 6 && e.durationHours >= 48,
  },
];

export interface RedFlagOutcome {
  readonly ids: readonly string[];
  readonly descriptions: readonly string[];
  readonly band: TriageBand | null;
}

export function detectRedFlags(e: SymptomEpisode): RedFlagOutcome {
  const hits = RED_FLAG_RULES.filter((r) => r.matches(e));
  if (hits.length === 0) return { ids: [], descriptions: [], band: null };
  const worst = hits.some((h) => h.band === 'EMERGENCY') ? 'EMERGENCY' : 'URGENT';
  return {
    ids: hits.map((h) => h.id),
    descriptions: hits.map((h) => h.description),
    band: worst,
  };
}
