import { GLOW } from './authTheme';

export interface Field {
  id: string;
  colour: string;

  peak: number;

  cx: number;
  cy: number;

  rx: number;
  ry: number;
}

export function tail(peak: number): { offset: string; opacity: number }[] {
  return [
    { offset: '0',    opacity: peak },
    { offset: '0.18', opacity: peak * 0.94 },
    { offset: '0.34', opacity: peak * 0.82 },
    { offset: '0.48', opacity: peak * 0.66 },
    { offset: '0.62', opacity: peak * 0.46 },
    { offset: '0.74', opacity: peak * 0.28 },
    { offset: '0.86', opacity: peak * 0.13 },
    { offset: '1',    opacity: 0 },
  ];
}

export const WELCOME_FIELDS: Field[] = [

  { id: 'wTopCream',   colour: GLOW.cream,      peak: 1.00, cx: 0.50,  cy: -0.30, rx: 1.70, ry: 0.78 },
  { id: 'wTopPeachL',  colour: GLOW.peachLight, peak: 0.92, cx: 0.42,  cy: -0.26, rx: 1.40, ry: 0.62 },
  { id: 'wTopPeach',   colour: GLOW.peach,      peak: 0.78, cx: 0.30,  cy: -0.22, rx: 1.10, ry: 0.48 },

  { id: 'wTrOrange',   colour: GLOW.orange,     peak: 0.72, cx: 1.14,  cy: -0.16, rx: 1.05, ry: 0.46 },
  { id: 'wTrAmber',    colour: GLOW.amber,      peak: 0.58, cx: 1.26,  cy: -0.06, rx: 0.86, ry: 0.38 },

  { id: 'wBlPinkL',    colour: GLOW.pinkLight,  peak: 0.96, cx: -0.14, cy: 1.26,  rx: 1.45, ry: 0.66 },
  { id: 'wBlBlush',    colour: GLOW.blush,      peak: 0.84, cx: -0.20, cy: 1.18,  rx: 1.15, ry: 0.54 },
  { id: 'wBlPink',     colour: GLOW.pink,       peak: 0.66, cx: -0.26, cy: 1.10,  rx: 0.92, ry: 0.44 },

  { id: 'wBrPeach',    colour: GLOW.peach,      peak: 0.74, cx: 1.18,  cy: 1.22,  rx: 1.10, ry: 0.50 },
  { id: 'wBrOrange',   colour: GLOW.orange,     peak: 0.56, cx: 1.30,  cy: 1.12,  rx: 0.88, ry: 0.40 },

  { id: 'wLeftCream',  colour: GLOW.cream,      peak: 0.70, cx: -0.34, cy: 0.42,  rx: 1.15, ry: 0.95 },
  { id: 'wRightCream', colour: GLOW.cream,      peak: 0.70, cx: 1.34,  cy: 0.58,  rx: 1.15, ry: 0.95 },
  { id: 'wBotCream',   colour: GLOW.cream,      peak: 0.62, cx: 0.50,  cy: 1.30,  rx: 1.70, ry: 0.68 },
];

export const AUTH_FIELDS: Field[] = [

  { id: 'aPinkWide', colour: GLOW.authPink,   peak: 0.62, cx: -0.02, cy: 1.16, rx: 1.30, ry: 0.54 },
  { id: 'aPinkMid',  colour: GLOW.authPink,   peak: 0.74, cx: -0.14, cy: 1.10, rx: 0.92, ry: 0.44 },
  { id: 'aPinkCore', colour: GLOW.authPink,   peak: 0.86, cx: -0.22, cy: 1.05, rx: 0.66, ry: 0.34 },

  { id: 'aOrgWide',  colour: GLOW.authOrange, peak: 0.64, cx: 1.02,  cy: 1.14, rx: 1.30, ry: 0.56 },
  { id: 'aOrgMid',   colour: GLOW.authOrange, peak: 0.78, cx: 1.14,  cy: 1.08, rx: 0.92, ry: 0.46 },
  { id: 'aOrgCore',  colour: GLOW.authOrange, peak: 0.90, cx: 1.22,  cy: 1.03, rx: 0.66, ry: 0.36 },
];

export function fieldsFor(variant: 'auth' | 'welcome'): Field[] {
  return variant === 'welcome' ? WELCOME_FIELDS : AUTH_FIELDS;
}

export const SHAPE: Record<'auth' | 'welcome', { cx: number; cy: number; rx: number; ry: number }> = {
  welcome: { cx: 0.5, cy: 0.50, rx: 1.06, ry: 0.375 },

  auth:    { cx: 0.5, cy: 1.10, rx: 0.48, ry: 0.24 },
};
