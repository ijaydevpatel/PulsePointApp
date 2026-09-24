/**
 * Design tokens for the authentication and onboarding experience.
 *
 * These live apart from `src/ui/theme.ts` on purpose. The product theme is a
 * two-scheme system built around the triage bands; auth is a single fixed
 * light composition with its own palette and its own rules, and folding the
 * two together would mean adding a dozen tokens to the product theme that
 * only five screens ever read.
 */
import { TextStyle } from 'react-native';
import { FONT } from '../theme';

/* ─────────────────────────────── palette ────────────────────────────────── */

export const C = {
  /** Screen background. Near-white, never pure white - the white surfaces
   *  need something to sit against or the composition goes flat. */
  canvas: '#F7F7F9',
  /** Organic shape, pills, inputs. */
  surface: '#FFFFFF',

  /** Hero headings, button labels. 18.50:1 on canvas. */
  ink: '#0A0A0A',
  /** Supporting copy, form labels, account prompts. 14.87:1 on canvas. */
  ink2: '#222222',
  /** Placeholders and hints. 4.63:1 on white - supplementary to a real label. */
  ink3: '#6B6B70',

  /**
   * Warm peach accent.
   *
   * The specified value, #D88B63, measures 2.52:1 on the canvas. That is fine
   * for the glow and for anything decorative, but it fails WCAG AA the moment
   * it carries text - and the account-switcher link is text. So the hue and
   * the muted, warm character are kept exactly; only the lightness comes down,
   * to 4.88:1. Side by side the difference reads as the same colour.
   *
   * Links also carry an underline, so colour is never the only signal.
   */
  accent: '#A6572B',
  /**
   * The specified warm accent, exactly. Used wherever it is not carrying
   * text - the CTA arrow, which is decorative because the label beside it
   * already says what the button does.
   */
  accentSoft: '#D88B63',

  /** Error text. Warm rather than fire-engine red, to sit in this palette. */
  danger: '#A3342A',

  /** Input boundary. 3.02:1 on white, clearing 1.4.11 for UI components. */
  field: '#8E8E95',
  /** Purely decorative hairline. Never a control boundary. */
  hair: '#ECECEF',
} as const;

/**
 * The atmospheric palette, as specified.
 *
 * These are the colours of large diffused light fields, not of shapes. Each
 * one is used at low opacity with a long falloff and heavy overlap, so what
 * lands on screen is considerably paler than the swatch - that is the point.
 * A field rendered at its own value would read as a coloured block.
 */
export const GLOW = {
  /** Warm cream. Does most of the blending between warm and neutral. */
  cream: '#FDF7EE',
  /** Light peach. The first step out of cream. */
  peachLight: '#F6D5BD',
  /** Warm peach. Carries the warm region. */
  peach: '#F2B38F',
  /** Soft orange. */
  orange: '#EAA16C',
  /** Warm amber - the warmest point, used sparingly and never at full width. */
  amber: '#E7A15F',
  /** Pale blush. The first step out of neutral on the cool side. */
  blush: '#F2C1D2',
  /** Soft pink. */
  pink: '#E8A8C4',
  /** Light pink, for the outermost cool falloff. */
  pinkLight: '#F3D1DD',

  /*
   * Login and Sign Up use two hues and only two.
   *
   * The reference's lower band is not eight colours - it is one pink and one
   * orange, meeting in the middle. The apparent range from deep pink through
   * mauve, cream and peach to amber is what those two produce as their tails
   * thin out and cross; there is no third colour anywhere in it. Adding cream
   * and light-peach fields to "help" the blend, as an earlier pass did, is
   * what made the foot read as a row of separate washes.
   *
   * Sampled from the reference at its most saturated point on each side. The
   * lighter values are not listed because they are not needed: the same hue at
   * a lower alpha gives the whole progression.
   */
  authPink: '#E8AECF',
  authOrange: '#F0A45C',
} as const;

/* ─────────────────────────────── spacing ────────────────────────────────── */

/**
 * The composition rhythm, as proportions of the viewport rather than pixels.
 *
 * The negative space is the design here, so it cannot be a fixed number. On a
 * tall phone fixed gaps leave the composition bunched at the top with dead
 * space underneath; on a short one they push the account link off-screen. Each
 * step below is a fraction of screen height, clamped so the rhythm never
 * collapses on a small display or becomes absurd on a tablet.
 *
 * Login and Sign Up read the same function, so they cannot drift apart.
 */
export function gaps(height: number, width: number) {
  const v = (fraction: number, min: number, max: number) =>
    Math.round(Math.max(min, Math.min(max, height * fraction)));

  return {
    /** Top inset to the wordmark. */
    top: v(0.055, 32, 72),
    /** Wordmark to hero heading. */
    logoToHero: v(0.048, 28, 60),
    /** Hero heading to the first button. Generous - this is the main breath. */
    heroToButtons: v(0.070, 40, 88),
    /** Between the two auth buttons. Tight: they are one group. */
    betweenButtons: v(0.017, 12, 20),
    /** Buttons to the account prompt. */
    buttonsToSwitcher: v(0.058, 34, 72),
    /** Prompt to its link. */
    promptToLink: v(0.010, 7, 12),
    /** Hero to the first form field. */
    heroToForm: v(0.046, 28, 58),
    /** Side margin. Off width, not height. */
    edge: Math.round(Math.max(20, Math.min(40, width * 0.072))),
  };
}

export type Gaps = ReturnType<typeof gaps>;

/* ──────────────────────────────── type ──────────────────────────────────── */

/**
 * The one column width the whole flow uses.
 *
 * The Google and Email pills are 88% of the content box, and the form fields
 * were 100% - so stepping from the provider choice into the email form made
 * everything jump wider, which is most of why that screen looked unfinished.
 * Fields, the submit button and the pills now all measure the same.
 */
export const COLUMN = 0.88;

/**
 * Hero sizing, driven by the screen *and* by the longest line.
 *
 * Width alone is not enough. The line breaks in COPY are deliberate, but a
 * line that is too long for the available width soft-wraps anyway, and the
 * three-line welcome heading silently becomes four - which is exactly what it
 * did on a 412dp screen. The break pattern is part of the design, so the type
 * has to yield instead.
 *
 * 0.50 is a measured average advance for Playfair Display at Regular across
 * mixed-case text, as a fraction of the point size. Multiplying by the
 * character count of the longest line gives the width that line wants; the
 * size that makes it fit is the ceiling, and the width-proportional size is
 * the target. Take the smaller, then clamp.
 */
/**
 * Average advance for Playfair Display Regular across mixed-case text, as a
 * fraction of the point size.
 *
 * Was 0.50, which was measured optimistically and let "Welcome back." compute
 * a size it could not actually render - the Text then ellipsised it to
 * "Welcome bac…". 0.58 is deliberately pessimistic: the cost of over-
 * estimating is a headline a couple of points smaller than it had to be, and
 * the cost of under-estimating is truncated copy.
 */
export const HERO_ADVANCE = 0.58;

/**
 * Playfair's descenders drop about 0.21em below the baseline, so a line box of
 * 1.06em clips the tail of a 'y' or 'g' on the last line - Android measures
 * the block from the line box, not the glyph. 1.18 clears them and still reads
 * as set headline rather than body copy.
 */
export const HERO_LEADING = 1.18;

export function heroSize(width: number, longestLine = 12, edge = 28): number {
  const proportional = width * 0.148;
  const available = width - edge * 2;
  const fitsOnOneLine = available / (Math.max(1, longestLine) * HERO_ADVANCE);
  /*
   * Floor, not round: rounding up can add half a point back and push the
   * widest line past the column, which is all it takes for the hero to gain a
   * row or get ellipsised.
   *
   * The lower clamp is 18 rather than 26 because a floor above the fitting
   * size defeats the fitting size. At 26 on a 320dp screen, "Your health
   * picture" was computed at 24.9, clamped back up to 26, and overflowed -
   * the clamp reintroduced exactly the bug the calculation prevents. 18 is low
   * enough never to bind on real copy and still legible as display type.
   */
  return Math.floor(Math.max(18, Math.min(64, proportional, fitsOnOneLine)));
}

export const T: Record<string, TextStyle> = {
  /**
   * Playfair Display at Regular. The thin strokes are the whole point of the
   * face, and bold weights thicken them until it reads as a generic slab.
   * Line height is tight - 1.06 - because large editorial type set at normal
   * leading looks like body copy that grew.
   */
  hero: {
    fontFamily: FONT.serif,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  /** Everything that is not a headline. Sans, per the spec. */
  button: { fontFamily: FONT.medium, fontSize: 16.5, letterSpacing: -0.1, color: C.ink },
  cta: { fontFamily: FONT.semibold, fontSize: 15, letterSpacing: 1.4, color: C.ink },
  prompt: { fontFamily: FONT.regular, fontSize: 16, color: C.ink2 },
  link: { fontFamily: FONT.medium, fontSize: 16, color: C.accent, textDecorationLine: 'underline' },
  label: { fontFamily: FONT.medium, fontSize: 14, color: C.ink2, letterSpacing: 0.1 },
  input: { fontFamily: FONT.regular, fontSize: 16, color: C.ink },
  error: { fontFamily: FONT.regular, fontSize: 13.5, color: C.danger, lineHeight: 19 },
  /*
   * The app name. At 17 it measured smaller than the 16px supporting copy once
   * optical size is taken into account, which put the brand below the captions
   * in the hierarchy - backwards. 22 reads as the second thing on the screen
   * after the headline, which is where it belongs.
   */
  wordmark: { fontFamily: FONT.bold, fontSize: 22, letterSpacing: -0.4, color: C.ink },
};

/* ──────────────────────────────── shadow ────────────────────────────────── */

/**
 * "Almost invisible unless you look for it." Low opacity, wide blur, small
 * offset - the pill should read as floating a millimetre off the page, not as
 * a Material card.
 */
export const LIFT = {
  shadowColor: '#2A2118',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/* ───────────────────────────────── copy ─────────────────────────────────── */

/**
 * Every headline string in one place.
 *
 * Each entry is an array of lines, and the array *is* the line break - the
 * hero never soft-wraps, so a break lands where it is written here rather than
 * wherever the device's width happens to fall. Change the words by editing
 * this object; no layout anywhere reads the strings themselves.
 */
export const COPY = {
  welcomeHero: ['Welcome.', 'Your health picture', 'is ready.'],
  loginHero: ['Your health,', 'clearly read.'],
  signupHero: ['Start your', 'health record.'],
  // Two lines, like every other hero. As single lines these were the longest
  // strings in the set, so the fitting calculation drove them down to about
  // 30pt on a 412dp screen - half the size of the login headline beside them,
  // which is most of why the email screens read as unfinished.
  emailLoginHero: ['Welcome', 'back.'],
  emailSignupHero: ['Create your', 'account.'],
} as const;
