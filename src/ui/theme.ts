/**
 * Design tokens.
 *
 * Direction: clinical clarity, not sci-fi. The web app is dark, neon and
 * glassmorphic; for someone anxious at 2am that is decoration competing with
 * legibility. This is light, high-contrast and plainly worded, which is what
 * QR6 (WCAG 2.2 AA, 44pt targets) and PACMAD's cognitive-load attribute need.
 *
 * Colour carries meaning here. The only saturated colours in the app are the
 * four severity bands — nothing decorative is allowed to use them.
 */
import { TriageBand } from '../domain/entities';

export const C = {
  bg: '#FBFCFD',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F7FA',
  line: '#E4E9F0',
  lineStrong: '#CBD5E1',

  ink: '#0F1B2A',
  inkSoft: '#3D4A5C',
  muted: '#667085',
  faint: '#98A2B3',

  accent: '#0B5FFF',
  accentSoft: '#EAF1FF',

  ok: '#0E9F6E',
  warn: '#E8590C',
  danger: '#D6203A',
  dangerSoft: '#FFF1F3',
} as const;

/** Band colours. Used for the severity spine and nothing else. */
export const BAND: Record<TriageBand, { fg: string; bg: string; label: string; short: string }> = {
  SELF_CARE:   { fg: '#0E9F6E', bg: '#E8F8F1', label: 'Self-care at home', short: 'Self-care' },
  PHARMACY_GP: { fg: '#0B5FFF', bg: '#EAF1FF', label: 'Pharmacist or GP',  short: 'GP' },
  URGENT:      { fg: '#E8590C', bg: '#FFF3EA', label: 'Urgent care today', short: 'Urgent' },
  EMERGENCY:   { fg: '#D6203A', bg: '#FFF1F3', label: 'Emergency',         short: 'Emergency' },
};

/** 4pt base scale. */
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40,
} as const;

export const R = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

/** QR6: 44pt minimum touch target, applied through this constant only. */
export const TOUCH = 44;

/** Mutable on purpose: React Native's TextStyle wants FontVariant[], not a readonly tuple. */
const TABULAR: ('tabular-nums')[] = ['tabular-nums'];

export const T = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: C.ink },
  title:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: C.ink },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: C.muted },
  body:    { fontSize: 16, fontWeight: '400', lineHeight: 23, color: C.inkSoft },
  bodyStrong: { fontSize: 16, fontWeight: '600', color: C.ink },
  label:   { fontSize: 14, fontWeight: '600', color: C.ink },
  caption: { fontSize: 12.5, fontWeight: '400', lineHeight: 18, color: C.muted },
  mono:    { fontSize: 15, fontWeight: '700', fontVariant: TABULAR, color: C.ink },
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#0F1B2A', shadowOpacity: 0.05, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
};
