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

  readonly at: string;

  readonly title: string;

  readonly detail: string | null;

  readonly episodeId: string | null;
}

export interface ActivityLog {
  record(entry: Omit<ActivityEntry, 'id'>): Promise<void>;
  recent(limit?: number): Promise<readonly ActivityEntry[]>;
  clearActivity(): Promise<void>;
}
