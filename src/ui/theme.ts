import { createContext, useContext } from 'react';
import { TextStyle } from 'react-native';
import { TriageBand } from '../domain/entities';

export type Scheme = 'light' | 'dark';

export interface Palette {
  scheme: Scheme;

  bg: string;

  surface: string;

  sunken: string;

  raised: string;

  line: string;
  lineStrong: string;

  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;

  accent: string;
  accentSoft: string;
  onAccent: string;

  ok: string;
  warn: string;
  danger: string;
  dangerSoft: string;

  onDanger: string;

  scrim: string;

  barTint: string;
}

const light: Palette = {
  scheme: 'light',

  bg: '#F7F7F9',
  surface: '#FFFFFF',
  sunken: '#F0F0F3',
  raised: '#FFFFFF',

  line: '#ECECEF',
  lineStrong: '#8E8E95',

  ink: '#0A0A0A',
  inkSoft: '#222222',
  muted: '#5C6273',
  faint: '#6B6B70',

  accent: '#D42140',
  accentSoft: '#FDEEF1',
  onAccent: '#FFFFFF',

  ok: '#007E50',
  warn: '#C2510A',
  danger: '#C41834',
  dangerSoft: '#FFF0F2',
  onDanger: '#FFFFFF',

  scrim: 'rgba(10,10,10,0.42)',
  barTint: 'rgba(255,255,255,0.72)',
};

const dark: Palette = {
  scheme: 'dark',

  bg: '#0B0B0C',
  surface: '#17171A',
  sunken: '#202024',
  raised: '#1D1D21',

  line: '#2B2B30',
  lineStrong: '#65656B',

  ink: '#F4F4F6',
  inkSoft: '#CACAD0',
  muted: '#9A9AA2',
  faint: '#6E6E76',

  accent: '#FF7A8F',
  accentSoft: '#2B141A',
  onAccent: '#1A0308',

  ok: '#3ECF98',
  warn: '#FF9A52',
  danger: '#FF6B81',
  dangerSoft: '#2A151B',
  onDanger: '#2A0009',

  scrim: 'rgba(0,0,0,0.62)',
  barTint: 'rgba(20,20,22,0.72)',
};

export const PALETTES: Record<Scheme, Palette> = { light, dark };

export interface BandStyle {
  fg: string;

  bg: string;

  solid: string;
  onSolid: string;

  solidEdge: string;
  label: string;
  short: string;
}

const bandsLight: Record<TriageBand, BandStyle> = {
  SELF_CARE:   { solidEdge: '#0B7A52', fg: '#0B7A52', bg: '#E4F6EE', solid: '#0E9F6E', onSolid: '#FFFFFF', label: 'Self-care at home', short: 'Self-care' },
  PHARMACY_GP: { solidEdge: '#2B36C9', fg: '#2B36C9', bg: '#EAECFD', solid: '#3A46E8', onSolid: '#FFFFFF', label: 'Pharmacist or GP',  short: 'GP' },
  URGENT:      { solidEdge: '#B84A08', fg: '#B84A08', bg: '#FFF0E4', solid: '#E8590C', onSolid: '#FFFFFF', label: 'Urgent care today', short: 'Urgent' },
  EMERGENCY:   { solidEdge: '#B01530', fg: '#B01530', bg: '#FFEDF0', solid: '#D6203A', onSolid: '#FFFFFF', label: 'Emergency',         short: 'Emergency' },
};

const bandsDark: Record<TriageBand, BandStyle> = {
  SELF_CARE:   { solidEdge: '#4BD6A0', fg: '#4BD6A0', bg: '#12291F', solid: '#17B57E', onSolid: '#04140D', label: 'Self-care at home', short: 'Self-care' },
  PHARMACY_GP: { solidEdge: '#9AA2FF', fg: '#9AA2FF', bg: '#191D38', solid: '#5C67F2', onSolid: '#FFFFFF', label: 'Pharmacist or GP',  short: 'GP' },
  URGENT:      { solidEdge: '#FFA366', fg: '#FFA366', bg: '#2E1B0C', solid: '#F2751A', onSolid: '#1A0A02', label: 'Urgent care today', short: 'Urgent' },
  EMERGENCY:   { solidEdge: '#FF7D90', fg: '#FF7D90', bg: '#2E1319', solid: '#E23A52', onSolid: '#FFFFFF', label: 'Emergency',         short: 'Emergency' },
};

export const BANDS: Record<Scheme, Record<TriageBand, BandStyle>> = {
  light: bandsLight,
  dark: bandsDark,
};

export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',

  serif: 'PlayfairDisplay_400Regular',
  serifMedium: 'PlayfairDisplay_500Medium',
} as const;

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export type TypeToken =
  | 'hero' | 'display' | 'title' | 'heading' | 'section'
  | 'body' | 'bodyStrong' | 'label' | 'caption' | 'micro' | 'numeric';

export const TYPE: Record<TypeToken, TextStyle> = {
  hero:       { fontFamily: FONT.black,     fontSize: 76, lineHeight: 78, letterSpacing: -3.5, fontVariant: TABULAR },
  display:    { fontFamily: FONT.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -1.2 },
  title:      { fontFamily: FONT.bold,      fontSize: 21, lineHeight: 26, letterSpacing: -0.6 },
  heading:    { fontFamily: FONT.semibold,  fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  section:    { fontFamily: FONT.bold,      fontSize: 11.5, lineHeight: 14, letterSpacing: 1.2 },
  body:       { fontFamily: FONT.regular,   fontSize: 15.5, lineHeight: 24, letterSpacing: 0.15 },
  bodyStrong: { fontFamily: FONT.semibold,  fontSize: 15.5, lineHeight: 22, letterSpacing: 0.1 },
  label:      { fontFamily: FONT.semibold,  fontSize: 14.5, lineHeight: 19, letterSpacing: 0.1 },
  caption:    { fontFamily: FONT.regular,   fontSize: 12.5, lineHeight: 18, letterSpacing: 0.2 },
  micro:      { fontFamily: FONT.medium,    fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  numeric:    { fontFamily: FONT.bold,      fontSize: 15, letterSpacing: -0.2, fontVariant: TABULAR },
};

export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40, huge: 56,
} as const;

export const R = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 } as const;
}

export const TOUCH = 44;

export const TAB_CLEARANCE = 96;

export function elevation(scheme: Scheme, step: 0 | 1 | 2 | 3) {
  if (step === 0) return {};
  const dark = scheme === 'dark';

  const specs = [
    null,
    {
      key:     { o: dark ? 0.30 : 0.04, r: 2,  y: 1 },
      ambient: { o: dark ? 0.20 : 0.02, r: 8,  y: 4 },
      e: 2
    },
    {
      key:     { o: dark ? 0.40 : 0.06, r: 4,  y: 2 },
      ambient: { o: dark ? 0.25 : 0.04, r: 16, y: 8 },
      e: 6
    },
    {
      key:     { o: dark ? 0.50 : 0.10, r: 12, y: 6 },
      ambient: { o: dark ? 0.30 : 0.08, r: 32, y: 16 },
      e: 14
    },
  ][step]!;

  return {
    shadowColor: '#000000',
    shadowOpacity: specs.key.o + specs.ambient.o,
    shadowRadius: specs.ambient.r,
    shadowOffset: { width: 0, height: specs.ambient.y },
    elevation: specs.e,
  };
}

export interface Glass {
  centreTint: string;

  edgeTint: string;

  centreBlur: number;

  edgeBlur: number;

  edgeWidth: number;

  rimTop: string;
  rimBottom: string;
  rimSide: string;
  specular: string;

  tint_mode: 'light' | 'dark';
}

export type GlassIntensity = number;
export const GLASS_DEFAULT: GlassIntensity = 0.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

export function glassFor(scheme: Scheme, t: GlassIntensity): Glass {
  const k = Math.min(1, Math.max(0, t));

  if (scheme === 'dark') {
    return {
      centreTint: rgba(18, 22, 30, lerp(0.10, 0.97, k)),
      edgeTint:   rgba(24, 29, 39, lerp(0.24, 0.99, k)),
      centreBlur: Math.round(lerp(72, 96, k)),
      edgeBlur:   Math.round(lerp(88, 100, k)),
      edgeWidth:  12,
      rimTop:    rgba(255, 255, 255, lerp(0.58, 0.20, k)),
      rimBottom: rgba(255, 255, 255, lerp(0.32, 0.10, k)),
      rimSide:   rgba(255, 255, 255, lerp(0.13, 0.05, k)),
      specular:  rgba(255, 255, 255, lerp(0.90, 0.30, k)),
      tint_mode: 'dark',
    };
  }

  return {
    centreTint: rgba(255, 255, 255, lerp(0.08, 0.97, k)),
    edgeTint:   rgba(255, 255, 255, lerp(0.22, 0.99, k)),
    centreBlur: Math.round(lerp(70, 96, k)),
    edgeBlur:   Math.round(lerp(86, 100, k)),
    edgeWidth:  12,
    rimTop:    rgba(255, 255, 255, lerp(1.00, 0.55, k)),
    rimBottom: rgba(255, 255, 255, lerp(0.85, 0.40, k)),
    rimSide:   rgba(255, 255, 255, lerp(0.42, 0.22, k)),
    specular:  rgba(255, 255, 255, lerp(1.00, 0.45, k)),
    tint_mode: 'light',
  };
}

export const GLASS: Record<Scheme, Glass> = {
  light: glassFor('light', 0),
  dark: glassFor('dark', 0),
};

export function composite(overlay: string, backdrop: string): string {
  const m = overlay.match(/rgba?\(([^)]+)\)/);
  if (!m) return overlay;
  const parts = m[1]!.split(',').map((x) => parseFloat(x.trim()));
  const [r, g, b] = parts;
  const a = parts.length > 3 ? parts[3]! : 1;
  const bd = [1, 3, 5].map((i) => parseInt(backdrop.slice(i, i + 2), 16));
  const out = [r!, g!, b!].map((c, i) => Math.round(c * a + bd[i]! * (1 - a)));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export const MOTION = {
  press: { scale: 0.955, damping: 20, stiffness: 520 },

  spring: { damping: 26, stiffness: 210, mass: 1 },

  flick: { damping: 0.8, response: 0.4 },

  fast: 140,
  base: 220,
  slow: 320,
  stagger: 45,

  liquid: { stretch: 1.25, squash: 0.9, damping: 15, stiffness: 180 },
} as const;

export interface Theme {
  scheme: Scheme;
  c: Palette;
  band: Record<TriageBand, BandStyle>;
  glass: Glass;

  glassIntensity: GlassIntensity;
  elev: (step: 0 | 1 | 2 | 3) => object;
}

export function buildTheme(scheme: Scheme, intensity: GlassIntensity = GLASS_DEFAULT): Theme {
  return {
    scheme,
    c: PALETTES[scheme],
    band: BANDS[scheme],
    glass: glassFor(scheme, intensity),
    glassIntensity: intensity,
    elev: (step) => elevation(scheme, step),
  };
}

export const ThemeContext = createContext<Theme>(buildTheme('light'));

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
