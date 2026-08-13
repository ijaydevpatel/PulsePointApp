/**
 * The navigation graph, as data.
 *
 * Keeping routes in one typed structure means Figure 6 in the report and the
 * running app cannot drift apart, and the ≤4-tap claim (R4) can be checked by
 * counting rather than by clicking.
 *
 * There is no landing screen. The app opens on Triage because the first screen
 * should be the task (§5.3, learnability).
 */
import { IconName } from '../components/Icon';

export type TabKey = 'triage' | 'medicines' | 'care' | 'records' | 'more';

export type RouteKey =
  | TabKey
  | 'result'      // pushed from triage
  | 'interactions' // pushed from medicines
  | 'checkin'     // pushed from more
  | 'news'
  | 'chat'
  | 'documents'
  | 'profile'
  | 'episode';    // pushed from records

export interface TabDef {
  key: TabKey;
  label: string;
  /** Name in the hand-drawn icon set (src/ui/components/Icon.tsx). */
  icon: IconName;
}

export const TABS: readonly TabDef[] = [
  { key: 'triage',    label: 'Triage',    icon: 'pulse' },
  { key: 'medicines', label: 'Medicines', icon: 'pill' },
  { key: 'care',      label: 'Care',      icon: 'pin' },
  { key: 'records',   label: 'Records',   icon: 'records' },
  { key: 'more',      label: 'More',      icon: 'more' },
];

export const DEFAULT_TAB: TabKey = 'triage';
