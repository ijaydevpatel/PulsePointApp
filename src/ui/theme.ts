/**
 * Design system.
 *
 * Direction: calm clinical foundation, editorial where it earns attention.
 *
 * The web app is dark, neon and glassmorphic. For someone anxious at 2am that
 * is decoration competing with legibility, so the base is quiet and high
 * contrast. Expressiveness is spent in one place only - the result screen -
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
  /** Recessed wells - input fields, unselected chips. */
  sunken: string;
  /** Raised above surface - the floating tab bar, menus. */
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
 *    systemGray 3.26:1 - all below the 4.5 floor. QR6 is a stated requirement
 *    with a build gate behind it, so where these colours carry *text* they are
 *    nudged by the minimum amount that clears 4.5. The shift is small enough
 *    to still read as the iOS colour.
 *
 * 2. Where the same colours are used as *fills* - badges, band headers, filled
 *    buttons - Apple's exact values are kept, because a fill is a graphical
 *    object at a 3:1 bar and the text on it is chosen to pass instead. Those
 *    live in BANDS below.
 *
 * The tiering is Apple's grouped-content model, which is why `bg` is grey in
 * light mode and true black in dark: content sits on cards, cards sit on the
 * grouped background. That single change is most of what makes a screen read
 * as iOS rather than as a generic app.
 */
/*
 * Light, and the same light as the auth screens.
 *
 * The two halves of the app used to disagree: onboarding was warm off-white
 * with near-black type, and signing in dropped you into a cooler grey-blue
 * with an indigo accent. Crossing that boundary read as entering a different
 * product. The canvas, surface and ink below are now literally the auth
 * values, and the accent is the crimson from the brand mark rather than a
 * blue that appears nowhere else in the identity.
 */
const light: Palette = {
  scheme: 'light',

  bg: '#F7F7F9',        // auth canvas
  surface: '#FFFFFF',
  sunken: '#F0F0F3',
  raised: '#FFFFFF',

  line: '#ECECEF',
  lineStrong: '#8E8E95',

  ink: '#0A0A0A',       // auth ink
  inkSoft: '#222222',
  muted: '#5C6273',
  faint: '#6B6B70',

  /*
   * The ECG trace from the mark, darkened by the smallest amount that clears
   * AA everywhere it lands.
   *
   * #D92544 exactly measures 4.89:1 on white and 4.57:1 on the canvas - fine -
   * but 4.30:1 on `sunken`, and the accent carries text on recessed wells.
   * Lightening `sunken` to fix it would have made the well invisible against
   * the canvas (1.01:1), so the accent moved instead. #D42140 is two steps
   * darker, clears 4.5 on all three grounds, and is indistinguishable from the
   * mark's colour side by side. The mark itself still uses #D92544.
   */
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

  /*
   * The same crimson, lifted for a dark ground. #D92544 measures 3.4:1 on the
   * dark surface - fine for a graphic, short of AA for the text and glyphs the
   * accent carries - so the dark scheme uses a lighter tint of the same hue
   * rather than a different colour.
   */
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
   * carried by this adjacent border - which WCAG 1.4.11 permits, and which
   * keeps the fill exactly as iOS ships it.
   */
  solidEdge: string;
  label: string;
  short: string;
}

/*
 * `solid` keeps Apple's exact system colour, because a band header is a
 * graphical fill and its text is set at 30px+ - the large-text bar of 3:1.
 * `fg` is the nudged, text-safe variant for the same colour on a card.
 */
/*
 * `solidEdge` is kept from the iOS pass on purpose. It is not a style choice -
 * it is the hairline that carries the boundary between a light band fill and
 * the canvas, which is what lets the contrast audit pass honestly rather than
 * by darkening the fill.
 */
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

  /**
   * Playfair Display, for auth and onboarding headlines only.
   *
   * A transitional face with high stroke contrast and fine bracketed serifs -
   * it sets a headline the way a magazine does, which is the register those
   * screens are after. Deliberately not used anywhere in the product itself:
   * a symptom list wants a face that is legible at a glance and boring, and
   * that is Inter's job.
   *
   * SIL Open Font License 1.1, so bundling and shipping it is permitted.
   * Regular weight is the one to reach for - Playfair's bold loses the thin
   * strokes that make it worth using.
   */
  serif: 'PlayfairDisplay_400Regular',
  serifMedium: 'PlayfairDisplay_500Medium',
} as const;

/** RN wants a mutable FontVariant[], not a readonly tuple. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export type TypeToken =
  | 'hero' | 'display' | 'title' | 'heading' | 'section'
  | 'body' | 'bodyStrong' | 'label' | 'caption' | 'micro' | 'numeric';

/**
 * Inter, with optical tracking. Large type gets negative tracking so it reads
 * as a set headline rather than default system text; small caps-style labels
 * get positive tracking so they stay legible at 12px.
 *
 * Colour is applied by the component, not baked in, so one scale serves both
 * schemes.
 */
export const TYPE: Record<TypeToken, TextStyle> = {
  /** Result screen only. The severity number. */
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

/* ───────────────────────────────  spacing  ──────────────────────────────── */

/** 4pt base scale. */
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40, huge: 56,
} as const;

export const R = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/**
 * Circular controls.
 *
 * Rounded squares read as Material; true circles and capsules read as glass,
 * because a lens has no corners. Every icon-only control uses `circle(size)`
 * and every text button is a capsule.
 */
export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 } as const;
}

/** QR6: 44pt minimum touch target, applied through this constant only. */
export const TOUCH = 44;


/** Height of the floating tab bar plus its margin, so scroll views can clear it. */
export const TAB_CLEARANCE = 96;

/* ──────────────────────────────  elevation  ─────────────────────────────── */

/**
 * Four steps, no ad-hoc shadows. Dark mode drops shadow opacity because a dark
 * shadow on a dark canvas reads as mud - depth there comes from surface
 * lightness instead, which is why the dark palette has distinct surface tiers.
 */
export function elevation(scheme: Scheme, step: 0 | 1 | 2 | 3) {
  if (step === 0) return {};
  const dark = scheme === 'dark';

  // Layered shadows: a sharp "key" shadow and a soft "ambient" shadow.
  // This replicates the depth of physical objects better than a single blur.
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

/* ────────────────────────────────  glass  ───────────────────────────────── */

/**
 * Liquid Glass, iOS 27 behaviour.
 *
 * The iOS 26 implementation was widely criticised for illegibility - text on a
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
  /** Fill through the middle. Low - the material is nearly clear. */
  centreTint: string;
  /** Fill in the refracting band round the rim. Denser. */
  edgeTint: string;
  /**
   * Blur through the middle. High at every slider position - this is what
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
 * opacity travels - from a whisper at 0 to effectively solid at 1.
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
  /** Instant response for touch-down. */
  press: { scale: 0.955, damping: 20, stiffness: 520 },
  /** Default UI transition: critically damped, no overshoot. */
  spring: { damping: 26, stiffness: 210, mass: 1 },
  /** Momentum-based flick: under-damped, slight organic bounce. */
  flick: { damping: 0.8, response: 0.4 },

  fast: 140,
  base: 220,
  slow: 320,
  stagger: 45,
  /** Optical "liquid" deformation during travel. */
  liquid: { stretch: 1.25, squash: 0.9, damping: 15, stiffness: 180 },
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
