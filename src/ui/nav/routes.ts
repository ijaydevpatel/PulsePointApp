/**
 * The navigation graph, as data.
 *
 * Keeping routes in one typed structure means Figure 6 in the report and the
 * running app cannot drift apart, and the ≤4-tap claim (R4) can be checked by
 * counting rather than by clicking.
 *
 * ── The five tabs ────────────────────────────────────────────────────────────
 *
 * Home, Symptoms, Medicines, Reports, Map. Four of the five mirror the
 * website's sidebar (frontend/src/components/dashboard/Sidebar.tsx); Home is
 * app-only and summarises what the phone already knows.
 *
 * Records, Chat and News are reached from the profile sheet rather than the
 * bar. They are real destinations, not a "More" bucket - the difference is
 * that account-adjacent and reference material sits behind the avatar, exactly
 * where the website puts its profile dropdown, while the five things you come
 * to the app *to do* stay one tap away.
 *
 * Five is also the width limit. The selected tab expands to carry its label,
 * which costs about 2.2 tabs' worth of room; see MIN_BAR_WIDTH in TabBar. A
 * sixth tab would push the unselected targets under the 44dp floor QR6 sets on
 * a 320dp phone, so the test suite asserts the arithmetic rather than trusting
 * it.
 *
 * The app opens on Home rather than on Triage. With a summary worth reading -
 * last band, outstanding red flags, current medicines - the first screen
 * answers "where do I stand" before asking the person to start a new task.
 */
import { IconName } from '../components/Icon';

export type TabKey =
  | 'home'        // app-only: health summary
  | 'triage'      // web: /dashboard/symptoms
  | 'medicines'   // web: /dashboard/medicine
  | 'chat'        // web: /dashboard/chat
  | 'care';       // web: /dashboard/map

export type RouteKey =
  | TabKey
  | 'records'      // reached from the profile sheet
  | 'news'         // reached from the profile sheet
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
  { key: 'home',      label: 'Home',      icon: 'home',    web: null },
  { key: 'triage',    label: 'Symptoms',  icon: 'pulse',   web: '/dashboard/symptoms' },
  { key: 'medicines', label: 'Medicines', icon: 'pill',    web: '/dashboard/medicine' },
  { key: 'chat',      label: 'AI Doctor', icon: 'message', web: '/dashboard/chat' },
  { key: 'care',      label: 'Map',       icon: 'pin',     web: '/dashboard/map' },
];

export const DEFAULT_TAB: TabKey = 'home';

/* ────────────────────────────── bar geometry ────────────────────────────── */

/**
 * Flex units the selected tab takes; unselected tabs take one each.
 *
 * Lives here rather than in TabBar because it is the reason the bar is capped
 * at five destinations, and that is a fact about the navigation graph. Keeping
 * it beside TABS also means the test suite can import both without pulling in
 * a component.
 */
export const SELECTED_UNITS = 2.45;
/** Inner padding of the capsule, per side. */
export const BAR_PAD = 6;
/** Gap between the capsule and the screen edge, per side. */
export const BAR_SIDE_MARGIN = 16;

/* ─────────────────────────── inside the pill ────────────────────────────── */

/**
 * What the selected pill has to fit, and why these live here.
 *
 * "Symptoms" was arriving as "Sympto...". The pill was wide enough to look
 * right and too narrow to hold its own label, which is the worst of both: it
 * reads as a layout that nearly works.
 *
 * The cause was a gate that asserted less than it claimed. It required 40dp
 * for the label while its own comment said "Medicines needs roughly 62" - so
 * it passed on every label it was meant to catch. These constants exist so
 * the component and that gate cannot disagree about the furniture again: the
 * test measures the same numbers the pill is drawn from.
 */
export const PILL_ICON = 20;
export const PILL_GAP = 6;
export const PILL_PAD_H = 8;
export const PILL_FONT = 13;

/**
 * Rough width of a label, in dp.
 *
 * 0.58em per character is a deliberate over-estimate for Inter at this weight:
 * lowercase runs narrower, and the labels that matter here are mixed case.
 * Erring wide means the check fails before the ellipsis appears rather than
 * after, which is the only useful direction for it to be wrong in.
 */
export function labelWidth(label: string, fontSize = PILL_FONT): number {
  return label.length * fontSize * 0.58;
}

/** Everything the selected pill must hold: glyph, gap, padding, label. */
export function pillContentWidth(label: string): number {
  return PILL_ICON + PILL_GAP + PILL_PAD_H * 2 + labelWidth(label);
}

export const UNITS = (TABS.length - 1) + SELECTED_UNITS;

/**
 * Narrowest viewport at which every unselected tab still clears the 44dp touch
 * floor (QR6).
 *
 *   available  = width - 2*BAR_SIDE_MARGIN - 2*BAR_PAD
 *   unselected = available / UNITS  ≥  44
 *
 * With five tabs that is 6.45 units and needs about 328dp. The narrowest
 * Android phone in circulation is 320dp, which is below that - so the bar
 * sheds its side margins there, and the floor still holds with 45dp per tab.
 * Losing the floating inset is a far smaller loss than losing a touch target.
 * A sixth tab would not clear 44dp even then, which is why the bar stops at
 * five and why the test suite asserts it against the real TABS length.
 */
export const MIN_BAR_WIDTH =
  UNITS * 44 + 2 * BAR_PAD + 2 * BAR_SIDE_MARGIN;

/**
 * Where the selected pill sits, for a bar of this width.
 *
 * Pure arithmetic, and deliberately here rather than in the component: the
 * row is divided by flex weights, so the slot boundaries are decided by the
 * same numbers that decide the layout. Measuring the tabs to find out where
 * they are would be asking the screen a question the maths has already
 * answered - and would drift the moment a label changed length.
 *
 * Returns zeroes before the bar has been laid out, which the caller treats as
 * "not ready to draw yet" rather than as a position.
 */
export function pillSlot(barWidth: number, index: number): { left: number; width: number } {
  const inner = barWidth - BAR_PAD * 2;
  if (!(inner > 0)) return { left: 0, width: 0 };

  const unit = inner / UNITS;
  const i = Math.min(Math.max(index, 0), TABS.length - 1);

  return { left: BAR_PAD + i * unit, width: SELECTED_UNITS * unit };
}
