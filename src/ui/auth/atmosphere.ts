/**
 * The atmosphere, as data.
 *
 * Kept out of the component so it can be reasoned about and tested directly:
 * the rules that matter here — every field centred off-screen, a long enough
 * tail, the auth screens carrying no colour — are properties of these numbers,
 * not of the JSX that draws them.
 *
 * All positions and radii are fractions of the viewport, never pixels, so the
 * composition and the falloff distance both scale with the screen.
 */
import { GLOW } from './authTheme';

export interface Field {
  id: string;
  colour: string;
  /** Alpha at the field's own centre, which is off-screen. */
  peak: number;
  /** Centre as a fraction of viewport width / height. Outside 0–1 by design. */
  cx: number;
  cy: number;
  /** Radii as a fraction of viewport width / height. */
  rx: number;
  ry: number;
}

/**
 * A very long, concave alpha tail.
 *
 * Eight stops, barely moving over the first third of the radius and then
 * easing away slowly. The concavity is the point: a linear ramp has a constant
 * slope, and on an 8-bit panel a constant slope across a large area is exactly
 * what produces visible banding. No segment here is steep enough to quantise.
 *
 * Because every field's centre sits outside the viewport, the stops that
 * actually land on screen are roughly those from 0.55 outward — the bright
 * core and the steepest part of the curve are never drawn.
 */
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

/**
 * Welcome: light entering from the outer areas.
 *
 * Warm across the top and down the right, cool along the bottom-left, the two
 * families meeting through broad cream washes that add no hue of their own.
 * Each corner is stacked — a wide pale field with a narrower, warmer one
 * inside it — so it reads as a progression rather than as a single colour.
 *
 * The radii are large enough that the falloff runs most of the way toward the
 * middle before reaching zero, which is what leaves the centre off-white
 * without a seam anywhere.
 */
export const WELCOME_FIELDS: Field[] = [
  /* top edge, warm */
  { id: 'wTopCream',   colour: GLOW.cream,      peak: 1.00, cx: 0.50,  cy: -0.30, rx: 1.70, ry: 0.78 },
  { id: 'wTopPeachL',  colour: GLOW.peachLight, peak: 0.92, cx: 0.42,  cy: -0.26, rx: 1.40, ry: 0.62 },
  { id: 'wTopPeach',   colour: GLOW.peach,      peak: 0.78, cx: 0.30,  cy: -0.22, rx: 1.10, ry: 0.48 },

  /* top-right, warmest */
  { id: 'wTrOrange',   colour: GLOW.orange,     peak: 0.72, cx: 1.14,  cy: -0.16, rx: 1.05, ry: 0.46 },
  { id: 'wTrAmber',    colour: GLOW.amber,      peak: 0.58, cx: 1.26,  cy: -0.06, rx: 0.86, ry: 0.38 },

  /* bottom-left, cool */
  { id: 'wBlPinkL',    colour: GLOW.pinkLight,  peak: 0.96, cx: -0.14, cy: 1.26,  rx: 1.45, ry: 0.66 },
  { id: 'wBlBlush',    colour: GLOW.blush,      peak: 0.84, cx: -0.20, cy: 1.18,  rx: 1.15, ry: 0.54 },
  { id: 'wBlPink',     colour: GLOW.pink,       peak: 0.66, cx: -0.26, cy: 1.10,  rx: 0.92, ry: 0.44 },

  /* bottom-right, warm again so the foot is not one flat pink */
  { id: 'wBrPeach',    colour: GLOW.peach,      peak: 0.74, cx: 1.18,  cy: 1.22,  rx: 1.10, ry: 0.50 },
  { id: 'wBrOrange',   colour: GLOW.orange,     peak: 0.56, cx: 1.30,  cy: 1.12,  rx: 0.88, ry: 0.40 },

  /* long cream washes blending the two families through the middle third */
  { id: 'wLeftCream',  colour: GLOW.cream,      peak: 0.70, cx: -0.34, cy: 0.42,  rx: 1.15, ry: 0.95 },
  { id: 'wRightCream', colour: GLOW.cream,      peak: 0.70, cx: 1.34,  cy: 0.58,  rx: 1.15, ry: 0.95 },
  { id: 'wBotCream',   colour: GLOW.cream,      peak: 0.62, cx: 0.50,  cy: 1.30,  rx: 1.70, ry: 0.68 },
];

/**
 * Login and Sign Up: two colours along the foot, meeting in the middle.
 *
 * Pink on the left, orange on the right, and nothing else. What looks in the
 * reference like a range running pink → mauve → cream → peach → amber is those
 * two hues thinning out and crossing each other; none of the intermediate
 * colours exists as a field of its own. An earlier pass added cream and light
 * peach through the centre to "help" the blend and got three visibly separate
 * washes instead of one.
 *
 * Each side is three fields of the *same* hue at descending width and rising
 * alpha. Same colour, different reach — that is where the value progression
 * comes from, and it cannot introduce a seam because there is no second hue to
 * seam against.
 *
 * The blend above the dome is not drawn. Both widest fields have an rx large
 * enough to carry past the centre line, so their tails overlap there, each at
 * roughly a quarter of its own strength. That overlap is the centre.
 *
 * Every centre sits below the bottom edge, so light enters from beneath and
 * fades upward — the bright core is never on screen, and the upper half stays
 * off-white without needing a mask. The warm side starts a little higher than
 * the cool side, as it does in the reference.
 */
export const AUTH_FIELDS: Field[] = [
  /* left — pink. Widest first; it reaches past centre to meet the orange. */
  { id: 'aPinkWide', colour: GLOW.authPink,   peak: 0.62, cx: -0.02, cy: 1.16, rx: 1.30, ry: 0.54 },
  { id: 'aPinkMid',  colour: GLOW.authPink,   peak: 0.74, cx: -0.14, cy: 1.10, rx: 0.92, ry: 0.44 },
  { id: 'aPinkCore', colour: GLOW.authPink,   peak: 0.86, cx: -0.22, cy: 1.05, rx: 0.66, ry: 0.34 },

  /* right — orange. Same construction, reaching slightly higher. */
  { id: 'aOrgWide',  colour: GLOW.authOrange, peak: 0.64, cx: 1.02,  cy: 1.14, rx: 1.30, ry: 0.56 },
  { id: 'aOrgMid',   colour: GLOW.authOrange, peak: 0.78, cx: 1.14,  cy: 1.08, rx: 0.92, ry: 0.46 },
  { id: 'aOrgCore',  colour: GLOW.authOrange, peak: 0.90, cx: 1.22,  cy: 1.03, rx: 0.66, ry: 0.36 },
];


export function fieldsFor(variant: 'auth' | 'welcome'): Field[] {
  return variant === 'welcome' ? WELCOME_FIELDS : AUTH_FIELDS;
}

/**
 * The white ellipse, per variant.
 *
 * Two quite different shapes, because the two screens use them differently.
 *
 * Welcome's is wider than the viewport, so the visible arc is the shallow
 * middle of the curve and colour shows above and below it.
 *
 * Auth's is a dome at the foot, narrower than the viewport, so colour shows
 * above it *and* in both bottom corners beside it.
 */
export const SHAPE: Record<'auth' | 'welcome', { cx: number; cy: number; rx: number; ry: number }> = {
  /** Centred, leaving colour above and below. Unchanged. */
  welcome: { cx: 0.5, cy: 0.50, rx: 1.06, ry: 0.375 },

  /*
   * Auth sits at the foot of the screen, not across the middle.
   *
   * It was centred at 0.83 with ry 0.365, which spans 0.47–1.20 — the entire
   * lower half. Any atmosphere placed down there was painted over by it, so
   * the colour could not be visible whatever the fields did. Dropping the
   * centre below the bottom edge leaves a dome whose apex sits near 0.86. The
   * colour is then visible in the band between where the fields die out
   * (~0.58 on the warm side, ~0.62 on the cool one) and where the dome
   * begins, and it wraps around both of its shoulders into the corners.
   *
   * Unlike the welcome shape, this one is *narrower* than the screen: the
   * reference shows colour in both bottom corners, beside the dome rather than
   * only above it. Half-width at the bottom edge works out at about 0.44, so
   * roughly six per cent of the width stays coloured on each side.
   *
   * Content is unaffected: on every size checked, the composition ends around
   * 0.57 of the height, so it continues to sit above the dome rather than on
   * it — which is where it already was relative to the old shape's upper arc.
   */
  auth:    { cx: 0.5, cy: 1.10, rx: 0.48, ry: 0.24 },
};
