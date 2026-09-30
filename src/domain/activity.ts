/**
 * What the person has done in the app.
 *
 * ── Why this is separate from EpisodeStore ───────────────────────────────────
 *
 * A symptom check is a clinical record: it has a score, a band, red flags and
 * reasoning, and it is the thing another clinician might read. Looking up a
 * medicine interaction or searching for a pharmacy is not that. It is a trace
 * of use - useful for "what did I look up last week", and nothing to base a
 * decision on.
 *
 * Keeping them in one table would have meant every row carrying the clinical
 * fields and most of them leaving those fields empty, which is how a schema
 * starts lying about what it holds.
 *
 * ── What is deliberately not recorded ────────────────────────────────────────
 *
 * The content of AI Doctor conversations, and the names of places searched
 * for. The entry says a chat happened and roughly what it was about, because
 * that is what makes a history list useful; it is not a transcript. A log
 * that quietly accumulates everything typed into a health app is a liability
 * rather than a feature, and this one stays on the device either way.
 */

export type ActivityKind =
  | 'SYMPTOM_CHECK'
  | 'MEDICINE_CHECK'
  | 'CARE_SEARCH'
  | 'DOCTOR_CHAT';

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  SYMPTOM_CHECK: 'Symptom check',
  MEDICINE_CHECK: 'Medicine check',
  CARE_SEARCH: 'Care search',
  DOCTOR_CHAT: 'AI Doctor',
};

export interface ActivityEntry {
  readonly id: string;
  readonly kind: ActivityKind;
  /** ISO 8601, so it sorts as a string and survives a round trip. */
  readonly at: string;
  /** One line: what was done. */
  readonly title: string;
  /** One line: the outcome, when there is one worth keeping. */
  readonly detail: string | null;
  /**
   * The episode this row stands for, when it is a symptom check.
   *
   * Lets the merged history open the full clinical record rather than the
   * one-line trace of it.
   */
  readonly episodeId: string | null;
}

export interface ActivityLog {
  /** Never throws: a log that breaks the app it is logging is not worth it. */
  record(entry: Omit<ActivityEntry, 'id'>): Promise<void>;
  recent(limit?: number): Promise<readonly ActivityEntry[]>;
  clearActivity(): Promise<void>;
}
