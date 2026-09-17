/**
 * The navigation graph, as data.
 *
 * Keeping routes in one typed structure means Figure 6 in the report and the
 * running app cannot drift apart, and the ≤4-tap claim (R4) can be checked by
 * counting rather than by clicking.
 *
 * ── Why every destination is its own tab ─────────────────────────────────────
 *
 * These seven mirror the website's sidebar (frontend/src/components/dashboard/
 * Sidebar.tsx) plus Records, which is app-only — the phone holds encrypted
 * history the site does not.
 *
 * Nothing is hidden behind a "More" bucket. That costs width: seven tabs on a
 * 360 dp screen gives roughly 51 dp each, which still clears the 44 pt minimum
 * QR6 sets, but leaves no room for a longer label than the ones below. If an
 * eighth destination is ever added, the bar has to become scrollable rather
 * than shrink further, because 8 × 45 dp would breach the touch floor.
 *
 * Profile and Settings deliberately do not appear here. They sit in the header,
 * exactly as the website puts them in its profile dropdown rather than its
 * sidebar — that is not grouping destinations, it is where account controls live.
 *
 * There is no landing screen. The app opens on Triage because the first screen
 * should be the task (§5.3, learnability).
 */
import { IconName } from '../components/Icon';

export type TabKey =
  | 'triage'      // web: /dashboard/symptoms
  | 'medicines'   // web: /dashboard/medicine
  | 'care'        // web: /dashboard/map
  | 'records'     // app-only: encrypted on-device history (FR5)
  | 'more';       // Consolidated hub for other features

export type RouteKey =
  | TabKey
  | 'chat'         // moved from tabs to stack/hub
  | 'news'         // moved from tabs to stack/hub
  | 'documents'    // moved from tabs to stack/hub
  | 'result'       // pushed from triage
  | 'interactions' // pushed from medicines
  | 'episode'      // pushed from records
  | 'checkin'      // app-only, pushed from triage
  | 'profile'      // pushed from the header
  | 'settings'     // pushed from the header: theme, about, data controls
  | 'auth';        // sign in / sign up, pushed from anywhere that needs a session

export interface TabDef {
  key: TabKey;
  label: string;
  /** Name in the hand-drawn icon set (src/ui/components/Icon.tsx). */
  icon: IconName;
  /** The website route this mirrors, or null when the screen is app-only. */
  web: string | null;
}

export const TABS: readonly TabDef[] = [
  { key: 'triage',    label: 'Symptoms',  icon: 'pulse',     web: '/dashboard/symptoms' },
  { key: 'medicines', label: 'Medicines', icon: 'pill',      web: '/dashboard/medicine' },
  { key: 'care',      label: 'Map',       icon: 'pin',       web: '/dashboard/map' },
  { key: 'records',   label: 'Records',   icon: 'records',   web: null },
  { key: 'more',      label: 'More',      icon: 'more',      web: null },
];

export const DEFAULT_TAB: TabKey = 'triage';
