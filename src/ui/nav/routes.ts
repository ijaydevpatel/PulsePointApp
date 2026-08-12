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
export type TabKey = 'triage' | 'medicines' | 'care' | 'records' | 'more';

export type RouteKey =
  | TabKey
  | 'result'      // pushed from triage
  | 'checkin'     // pushed from more
  | 'news'
  | 'chat'
  | 'documents'
  | 'profile'
  | 'episode';    // pushed from records

export interface TabDef {
  key: TabKey;
  label: string;
  /** Simple geometric glyph — no icon font dependency, no download weight. */
  glyph: 'pulse' | 'pill' | 'pin' | 'rows' | 'dots';
}

export const TABS: readonly TabDef[] = [
  { key: 'triage',    label: 'Triage',    glyph: 'pulse' },
  { key: 'medicines', label: 'Medicines', glyph: 'pill' },
  { key: 'care',      label: 'Care',      glyph: 'pin' },
  { key: 'records',   label: 'Records',   glyph: 'rows' },
  { key: 'more',      label: 'More',      glyph: 'dots' },
];

export const DEFAULT_TAB: TabKey = 'triage';
