/**
 * Design system.
 *
 * Direction: calm clinical foundation, editorial where it earns attention.
 *
 * The web app is dark, neon and glassmorphic. For someone anxious at 2am that
 * is decoration competing with legibility, so the base is quiet and high
 * contrast. Expressiveness is spent in one place only — the result screen —
 * because that is the moment the app has something to say.
 *
 * Three rules the rest of the UI must obey:
 *   1. Colour carries meaning. The four severity colours appear nowhere
 *      decorative. Everything else is ink, surface or the single accent.
 *   2. Every surface sits on a defined elevation step. No ad-hoc shadows.
 *   3. Every interactive element responds within 100ms, by motion or haptic.
 *
 * Both schemes are contrast-audited against WCAG 2.2 AA (QR6) by
 * scripts/contrast-audit.js, which fails the build on a regression.
 */
import { createContext, useContext } from 'react';
import { TextStyle } from 'react-native';
import { TriageBand } from '../domain/entities';

export type Scheme = 'light' | 'dark';

/* ────────────────────────────────  colour  ──────────────────────────────── */

export interface Palette {
  scheme: Scheme;

  /** Furthest back. The app canvas. */
  bg: string;
  /** Cards and sheets sitting on the canvas. */
  surface: string;
  /** Recessed wells — input fields, unselected chips. */
  sunken: string;
  /** Raised above surface — the floating tab bar, menus. */
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
  /** Text on a solid danger fill. White fails AA on the lighter dark-mode red. */
  onDanger: string;

  /** Scrim behind modals. */
  scrim: string;
  /** Tint under the blurred tab bar, so it reads on both schemes. */
  barTint: string;
}

/*
 * Built on the iOS system palette.
 *
 * Two honest deviations, both forced and both measured:
 *
 * 1. Several of Apple's system colours do not meet WCAG 2.2 AA as small text.
 *    systemBlue on white is 4.02:1, systemGreen 2.22:1, systemOrange 2.20:1,
 *    systemGray 3.26:1 — all below the 4.5 floor. QR6 is a stated requirement
 *    with a build gate behind it, so where these colours carry *text* they are
 *    nudged by the minimum amount that clears 4.5. The shift is small enough
 *    to still read as the iOS colour.
 *
 * 2. Where the same colours are used as *fills* — badges, band headers, filled
 *    buttons — Apple's exact values are kept, because a fill is a graphical
 *    object at a 3:1 bar and the text on it is chosen to pass instead. Those
 *    live in BANDS below.
 *
 * The tiering is Apple's grouped-content model, which is why `bg` is grey in
 * light mode and true black in dark: content sits on cards, cards sit on the
 * grouped background. That single change is most of what makes a screen read
 * as iOS rather than as a generic app.
 */
const light: Palette = {
  scheme: 'light',

  /*
   * iOS 26 runs content edge to edge on systemBackground and floats the chrome
   * over it. The previous values used the iOS 18 grouped model — a grey strip
   * with white cards on it — which is the single biggest reason the app read as
   * the older system. Cards are now a barely-raised fill on the same canvas
   * rather than islands on a different colour.
   */
  bg: '#FFFFFF',        // systemBackground
  surface: '#F7F7F9',   // secondarySystemFill, a hair above the canvas
  sunken: '#EFEFF2',
  raised: '#FFFFFF',

  line: '#C6C6C8',      // separator, Apple exact
  lineStrong: '#8C8C90',

  ink: '#000000',       // label, Apple exact
  inkSoft: '#3C3C43',   // secondaryLabel, Apple exact
  muted: '#66666B',     // systemGray, nudged from #8E8E93
  faint: '#8C8C90',     // tertiary, nudged from #AEAEB2 (icons only, 3:1)

  accent: '#005EE3',    // systemBlue, nudged from #007AFF
  accentSoft: '#E5F0FF',
  onAccent: '#FFFFFF',

  ok: '#007709',        // systemGreen as text, nudged
  warn: '#AF4500',      // systemOrange as text, nudged
  danger: '#CF0B00',    // systemRed as text, nudged
  dangerSoft: '#FFEBEA',
  onDanger: '#FFFFFF',

  scrim: 'rgba(0,0,0,0.40)',
  barTint: 'rgba(255,255,255,0.72)',
};

const dark: Palette = {
  scheme: 'dark',

  bg: '#000000',        // systemBackground, true black
  surface: '#141416',   // barely lifted off the canvas
  sunken: '#1E1E21',
  raised: '#2C2C2E',

  line: '#38383A',
  lineStrong: '#68686A',

  ink: '#FFFFFF',
  inkSoft: '#EBEBF5',
  muted: '#949499',
  faint: '#68686C',

  accent: '#1C96FF',    // systemBlue dark, nudged from #0A84FF
  accentSoft: '#0A2540',
  onAccent: '#000000',

  ok: '#30D158',        // Apple exact — already passes on black
  warn: '#FF9F0A',      // Apple exact — already passes
  danger: '#FF594E',    // nudged from #FF453A
  dangerSoft: '#2C1512',
  onDanger: '#000000',

  scrim: 'rgba(0,0,0,0.60)',
  barTint: 'rgba(28,28,30,0.70)',
};

export const PALETTES: Record<Scheme, Palette> = { light, dark };

/* ─────────────────────────────  severity bands  ─────────────────────────── */

export interface BandStyle {
  /** Text and stroke colour. Must pass AA on `bg` and on the canvas. */
  fg: string;
  /** Soft fill behind band text. */
  bg: string;
  /** Saturated fill for the editorial result header. Pairs with `onSolid`. */
  solid: string;
  onSolid: string;
  /**
   * Hairline drawn where `solid` meets the canvas.
   *
   * Apple's systemGreen and systemOrange are light colours: as a block on the
   * light grouped background they measure ~1.98:1, below the 3:1 needed for a
   * graphical boundary. Rather than darken Apple's colour, the boundary is
   * carried by this adjacent border — which WCAG 1.4.11 permits, and which
   * keeps the fill exactly as iOS ships it.
   */
  solidEdge: string;
  label: string;
  short: string;
}

/*
 * `solid` keeps Apple's exact system colour, because a band header is a
 * graphical fill and its text is set at 30px+ — the large-text bar of 3:1.
 * `fg` is the nudged, text-safe variant for the same colour on a card.
 */
const bandsLight: Record<TriageBand, BandStyle> = {
  SELF_CARE:   { solidEdge: '#007709', fg: '#007709', bg: '#E3F7E8', solid: '#34C759', onSolid: '#00230A', label: 'Self-care at home', short: 'Self-care' },
  PHARMACY_GP: { solidEdge: '#005EE3', fg: '#005EE3', bg: '#E5F0FF', solid: '#007AFF', onSolid: '#FFFFFF', label: 'Pharmacist or GP',  short: 'GP' },
  URGENT:      { solidEdge: '#AF4500', fg: '#AF4500', bg: '#FFF0E0', solid: '#FF9500', onSolid: '#2B1200', label: 'Urgent care today', short: 'Urgent' },
  EMERGENCY:   { solidEdge: '#CF0B00', fg: '#CF0B00', bg: '#FFEBEA', solid: '#FF3B30', onSolid: '#FFFFFF', label: 'Emergency',         short: 'Emergency' },
};

const bandsDark: Record<TriageBand, BandStyle> = {
  SELF_CARE:   { solidEdge: '#30D158', fg: '#30D158', bg: '#0E2914', solid: '#30D158', onSolid: '#00230A', label: 'Self-care at home', short: 'Self-care' },
  PHARMACY_GP: { solidEdge: '#1C96FF', fg: '#1C96FF', bg: '#0A2540', solid: '#0A84FF', onSolid: '#FFFFFF', label: 'Pharmacist or GP',  short: 'GP' },
  URGENT:      { solidEdge: '#FF9F0A', fg: '#FF9F0A', bg: '#2E1C00', solid: '#FF9F0A', onSolid: '#2B1200', label: 'Urgent care today', short: 'Urgent' },
  EMERGENCY:   { solidEdge: '#FF594E', fg: '#FF594E', bg: '#2C1512', solid: '#FF453A', onSolid: '#2B0300', label: 'Emergency',         short: 'Emergency' },
};

export const BANDS: Record<Scheme, Record<TriageBand, BandStyle>> = {
  light: bandsLight,
  dark: bandsDark,
};

/* ──────────────────────────────  typography  ────────────────────────────── */

/**
 * Inter, with optical tracking. Large type gets negative tracking so it reads
 * as a set headline rather than default system text; small caps-style labels
 * get positive tracking so they stay legible at 12px.
 */
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

/** RN wants a mutable FontVariant[], not a readonly tuple. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export type TypeToken =
  | 'hero' | 'largeTitle' | 'title1' | 'title2' | 'title3'
  | 'headline' | 'body' | 'bodyStrong' | 'callout' | 'subhead'
  | 'footnote' | 'caption1' | 'caption2' | 'numeric'
  // Retained aliases so screens written against the old scale still compile.
  | 'display' | 'title' | 'heading' | 'section' | 'label' | 'caption' | 'micro';

/**
 * The iOS text styles, at their default (Large) Dynamic Type sizes.
 *
 * Substituting Inter for SF Pro is not a preference — SF Pro is licensed for
 * use on Apple platforms only and cannot be shipped in an Android APK. Inter
 * was drawn as a UI face at similar proportions and is the closest thing that
 * can legally ship here.
 *
 * It is slightly wider than SF at the same size, so the tracking below is
 * pulled tighter than Apple's published values at display sizes to compensate.
 * Without that correction, headlines set noticeably looser than iOS and the
 * resemblance falls apart at exactly the sizes people notice.
 *
 * Colour is applied by the component, never baked in, so one scale serves both
 * appearances.
 */
export const TYPE: Record<TypeToken, TextStyle> = {
  /* Result screen only — the severity numeral. */
  hero:       { fontFamily: FONT.bold,      fontSize: 72, lineHeight: 76, letterSpacing: -2.6, fontVariant: TABULAR },

  largeTitle: { fontFamily: FONT.bold,      fontSize: 34, lineHeight: 41, letterSpacing: -0.9 },
  title1:     { fontFamily: FONT.bold,      fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  title2:     { fontFamily: FONT.bold,      fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  title3:     { fontFamily: FONT.semibold,  fontSize: 20, lineHeight: 25, letterSpacing: -0.42 },
  headline:   { fontFamily: FONT.semibold,  fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  body:       { fontFamily: FONT.regular,   fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  bodyStrong: { fontFamily: FONT.semibold,  fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  callout:    { fontFamily: FONT.regular,   fontSize: 16, lineHeight: 21, letterSpacing: -0.32 },
  subhead:    { fontFamily: FONT.regular,   fontSize: 15, lineHeight: 20, letterSpacing: -0.24 },
  footnote:   { fontFamily: FONT.regular,   fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  caption1:   { fontFamily: FONT.regular,   fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  caption2:   { fontFamily: FONT.regular,   fontSize: 11, lineHeight: 13, letterSpacing: 0.07 },
  numeric:    { fontFamily: FONT.semibold,  fontSize: 17, letterSpacing: -0.41, fontVariant: TABULAR },

  /*
   * Aliases from the previous scale. Kept so the redesign can land screen by
   * screen instead of in one unverifiable commit — each points at its nearest
   * iOS equivalent, so nothing renders wrongly in the meantime.
   */
  display:    { fontFamily: FONT.bold,      fontSize: 34, lineHeight: 41, letterSpacing: -0.9 },
  title:      { fontFamily: FONT.bold,      fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  heading:    { fontFamily: FONT.semibold,  fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  /* Grouped-list section header: uppercase footnote, the iOS convention. */
  section:    { fontFamily: FONT.regular,   fontSize: 13, lineHeight: 18, letterSpacing: 0.06 },
  label:      { fontFamily: FONT.regular,   fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  caption:    { fontFamily: FONT.regular,   fontSize: 15, lineHeight: 20, letterSpacing: -0.24 },
  micro:      { fontFamily: FONT.regular,   fontSize: 12, lineHeight: 16, letterSpacing: 0 },
};

/* ───────────────────────────────  spacing  ──────────────────────────────── */

/** 4pt base scale. */
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40, huge: 56,
} as const;

/**
 * iOS 26 corner radii.
 *
 * Radii grew substantially in 26 and are *concentric*: a card sits at 26, and
 * anything nested inside it uses the outer radius minus the padding, so the
 * curves stay parallel instead of crossing. Small, sharp 10pt cards are one of
 * the clearest iOS 18 tells.
 */
export const R = { xs: 10, sm: 16, md: 20, lg: 26, xl: 34, pill: 999 } as const;

/**
 * Radius for a shape nested inside another. Keeping curves parallel is what
 * makes nested rounded rectangles look drawn rather than stacked.
 */
export function concentric(outer: number, inset: number): number {
  return Math.max(4, outer - inset);
}

/**
 * Circular controls.
 *
 * Rounded squares read as Material; true circles and capsules read as glass,
 * because a lens has no corners. Every icon-only control uses `circle(size)`
 * and every text button is a capsule, so the shape language is consistent
 * rather than decided per component.
 */
export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 } as const;
}

/** QR6: 44pt minimum touch target, applied through this constant only. */
export const TOUCH = 44;

/** Standard list row height. */
export const ROW = 48;
/** Left inset where row content starts — separators align to it. */
export const ROW_INSET = 18;

/** Height of the floating tab bar plus its margin, so scroll views can clear it. */
export const TAB_CLEARANCE = 96;

/* ──────────────────────────────  elevation  ─────────────────────────────── */

/**
 * Four steps, no ad-hoc shadows. Dark mode drops shadow opacity because a dark
 * shadow on a dark canvas reads as mud — depth there comes from surface
 * lightness instead, which is why the dark palette has distinct surface tiers.
 */
export function elevation(scheme: Scheme, step: 0 | 1 | 2 | 3) {
  if (step === 0) return {};
  const dark = scheme === 'dark';
  const spec = [
    null,
    { o: dark ? 0.34 : 0.055, r: 10, y: 3, e: 2 },
    { o: dark ? 0.42 : 0.085, r: 20, y: 8, e: 6 },
    { o: dark ? 0.52 : 0.13,  r: 34, y: 16, e: 14 },
  ][step]!;
  return {
    shadowColor: '#000000',
    shadowOpacity: spec.o,
    shadowRadius: spec.r,
    shadowOffset: { width: 0, height: spec.y },
    elevation: spec.e,
  };
}

/* ────────────────────────────────  glass  ───────────────────────────────── */

/**
 * Liquid Glass, iOS 27 behaviour.
 *
 * The iOS 26 implementation was widely criticised for illegibility — text on a
 * bar sitting over text in the content beneath it. Apple's fix in iOS 27 was
 * not to make the material more opaque. It was to **blur the underlying
 * content far more aggressively**, which destroys the high-frequency detail of
 * whatever is behind (letterforms, edges) while preserving its average tone.
 * The result stays readable even in the worst case of dark text over dark text,
 * with the glass at maximum transparency.
 *
 * That distinction is the whole thing, and it is easy to get backwards: a clear
 * material with a *light* blur is the iOS 26 mistake. A clear material with a
 * *heavy* blur is iOS 27.
 *
 * iOS 27 also exposes the strength to the user as a slider in Settings →
 * Appearance, from maximum transparency to fully frosted (which is
 * indistinguishable from turning the effect off). `glassFor()` below maps that
 * 0..1 position onto the material, which is why intensity is a runtime value
 * here rather than a pair of constants.
 */
export interface Glass {
  /** Fill through the middle. Low — the material is nearly clear. */
  centreTint: string;
  /** Fill in the refracting band round the rim. Denser. */
  edgeTint: string;
  /**
   * Blur through the middle. High at every slider position — this is what
   * keeps overlaid text readable, not the tint.
   */
  centreBlur: number;
  /** Blur in the rim band. Higher still, which is what reads as lensing. */
  edgeBlur: number;
  /** Width of the refracting band, in points. */
  edgeWidth: number;

  rimTop: string;
  rimBottom: string;
  rimSide: string;
  specular: string;

  tint_mode: 'light' | 'dark';
}

/** Slider position. 0 = maximum transparency, 1 = fully frosted. */
export type GlassIntensity = number;
export const GLASS_DEFAULT: GlassIntensity = 0.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/**
 * Build the material for a scheme at a given slider position.
 *
 * Note what does *not* drop as the slider moves toward transparency: the blur.
 * It stays high throughout, because it is carrying legibility. Only the fill
 * opacity travels — from a whisper at 0 to effectively solid at 1.
 */
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

/** Retained for the contrast audit, which reads the worst case (fully clear). */
export const GLASS: Record<Scheme, Glass> = {
  light: glassFor('light', 0),
  dark: glassFor('dark', 0),
};

/**
 * Composite a translucent colour over an opaque one.
 *
 * Used by the contrast audit to work out what a label on glass is actually
 * sitting on, given a worst-case backdrop.
 */
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

/* ───────────────────────────────  motion  ───────────────────────────────── */

/**
 * One spring, used everywhere, so the app has a single physical character
 * rather than a different feel per screen. Durations stay under 300ms; past
 * that an interface starts to feel like it is thinking rather than responding.
 */
export const MOTION = {
  press: { scale: 0.965, damping: 18, stiffness: 420 },
  spring: { damping: 20, stiffness: 260, mass: 0.9 },
  fast: 140,
  base: 220,
  slow: 320,
  /** Delay between items in a staggered entrance. */
  stagger: 45,
  /**
   * The "liquid" in liquid glass. A moving element stretches along its
   * direction of travel and settles back — the way a droplet does. Without
   * this the material is just a static texture; the deformation is what makes
   * it read as a substance rather than a panel.
   */
  liquid: { stretch: 1.35, squash: 0.86, damping: 14, stiffness: 190 },
} as const;

/* ────────────────────────────────  context  ─────────────────────────────── */

export interface Theme {
  scheme: Scheme;
  c: Palette;
  band: Record<TriageBand, BandStyle>;
  glass: Glass;
  /** Slider position currently in effect, so controls can display it. */
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
