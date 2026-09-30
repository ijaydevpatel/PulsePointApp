import { IconName } from '../components/Icon';

export type TabKey =
  | 'home'
  | 'triage'
  | 'medicines'
  | 'chat'
  | 'care';

export type RouteKey =
  | TabKey
  | 'records'
  | 'news'
  | 'result'
  | 'interactions'
  | 'episode'
  | 'checkin'
  | 'profile'
  | 'settings'
  | 'auth';

export interface TabDef {
  key: TabKey;
  label: string;

  icon: IconName;

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

export const SELECTED_UNITS = 2.45;

export const BAR_PAD = 6;

export const BAR_SIDE_MARGIN = 16;

export const PILL_ICON = 20;
export const PILL_GAP = 6;
export const PILL_PAD_H = 8;
export const PILL_FONT = 13;

export function labelWidth(label: string, fontSize = PILL_FONT): number {
  return label.length * fontSize * 0.58;
}

export function pillContentWidth(label: string): number {
  return PILL_ICON + PILL_GAP + PILL_PAD_H * 2 + labelWidth(label);
}

export const UNITS = (TABS.length - 1) + SELECTED_UNITS;

export const MIN_BAR_WIDTH =
  UNITS * 44 + 2 * BAR_PAD + 2 * BAR_SIDE_MARGIN;

export function pillSlot(barWidth: number, index: number): { left: number; width: number } {
  const inner = barWidth - BAR_PAD * 2;
  if (!(inner > 0)) return { left: 0, width: 0 };

  const unit = inner / UNITS;
  const i = Math.min(Math.max(index, 0), TABS.length - 1);

  return { left: BAR_PAD + i * unit, width: SELECTED_UNITS * unit };
}
