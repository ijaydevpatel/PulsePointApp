/**
 * The auth screens carry their own palette, so the project's contrast gate -
 * which walks `theme.ts` - does not see them. This is that gate, for this
 * palette, so a future colour tweak fails the build rather than quietly
 * shipping unreadable text.
 *
 * Also covers the error mapping, because the one guarantee worth asserting
 * there is negative: no raw provider string ever reaches a person.
 */
import { C } from '../src/ui/auth/authTheme';
import {
  confirmError, emailError, humanAuthError, nameError, passwordError,
} from '../src/ui/auth/authErrors';

/* ────────────────────────────── contrast ────────────────────────────────── */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('auth palette meets WCAG 2.2 AA', () => {
  // Both grounds text actually lands on in this composition.
  const grounds: [string, string][] = [
    ['canvas', C.canvas],
    ['white surface', C.surface],
  ];

  const bodyText: [string, string][] = [
    ['hero / button ink', C.ink],
    ['supporting copy', C.ink2],
    ['placeholder', C.ink3],
    ['account link', C.accent],
    ['error', C.danger],
  ];

  test.each(grounds)('normal-size text clears 4.5:1 on %s', (_name, ground) => {
    for (const [label, fg] of bodyText) {
      const r = ratio(fg, ground);
      expect(`${label}: ${r.toFixed(2)}`).toBe(`${label}: ${r.toFixed(2)}`);
      expect(r).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('input boundaries clear 3:1 against the surface they sit on', () => {
    // WCAG 1.4.11 - a control whose edge you cannot see is a control you
    // cannot find.
    expect(ratio(C.field, C.surface)).toBeGreaterThanOrEqual(3);
  });

  test('the decorative accent is never promoted to text', () => {
    // #D88B63 is the specified accent and is deliberately kept for the glow
    // only; it fails AA as text, which is why C.accent exists separately.
    expect(ratio(C.accentSoft, C.canvas)).toBeLessThan(4.5);
    expect(C.accent).not.toBe(C.accentSoft);
  });
});

/* ──────────────────────────── error mapping ─────────────────────────────── */

describe('no raw provider error reaches the person', () => {
  const RAW = 'ClerkAPIError: form_password_pwned at /v1/client/sign_ups';

  it('maps known Clerk codes to plain language', () => {
    expect(humanAuthError({ errors: [{ code: 'form_password_incorrect' }] }))
      .toBe('Incorrect email or password.');
    expect(humanAuthError({ errors: [{ code: 'form_identifier_exists' }] }))
      .toBe('This email is already registered.');
  });

  it('does not distinguish unknown email from wrong password', () => {
    // Otherwise the sign-in form becomes an account-enumeration oracle.
    expect(humanAuthError({ errors: [{ code: 'form_identifier_not_found' }] }))
      .toBe(humanAuthError({ errors: [{ code: 'form_password_incorrect' }] }));
  });

  it('never echoes an unmapped message through', () => {
    const out = humanAuthError({ message: RAW });
    expect(out).toBe('Something went wrong. Please try again.');
    expect(out).not.toContain('Clerk');
    expect(out).not.toContain('form_');
    expect(out).not.toContain('/v1/');
  });

  it('recognises transport failures', () => {
    expect(humanAuthError({ message: 'Network request failed' }))
      .toMatch(/could not reach the server/i);
  });

  it('survives junk', () => {
    for (const junk of [null, undefined, 0, '', {}, []]) {
      expect(typeof humanAuthError(junk)).toBe('string');
      expect(humanAuthError(junk).length).toBeGreaterThan(0);
    }
  });
});

/* ───────────────────────────── field validation ─────────────────────────── */

describe('field validation', () => {
  it('accepts ordinary addresses and rejects the usual typos', () => {
    expect(emailError('dhruvi@example.com')).toBeNull();
    expect(emailError('a@b.co')).toBeNull();
    expect(emailError('')).toMatch(/enter your email/i);
    expect(emailError('nope')).toMatch(/valid email/i);
    expect(emailError('nope@')).toMatch(/valid email/i);
    expect(emailError('nope@example')).toMatch(/valid email/i);
    expect(emailError('a b@example.com')).toMatch(/valid email/i);
  });

  it('holds the 8-character floor', () => {
    expect(passwordError('')).toMatch(/enter your password/i);
    expect(passwordError('short12')).toMatch(/at least 8/i);
    expect(passwordError('longenough1')).toBeNull();
  });

  it('requires the confirmation to match exactly', () => {
    expect(confirmError('abcd1234', 'abcd1234')).toBeNull();
    expect(confirmError('abcd1234', 'abcd12345')).toMatch(/don't match/i);
    expect(confirmError('abcd1234', '')).toMatch(/confirm your password/i);
  });

  it('treats whitespace-only names as empty', () => {
    expect(nameError('   ')).toMatch(/enter your name/i);
    expect(nameError('Dhruvi')).toBeNull();
  });
});

/* ────────────────────────── responsive proportions ─────────────────────── */

import { COLUMN, COPY, HERO_ADVANCE, HERO_LEADING, gaps, heroSize } from '../src/ui/auth/authTheme';

describe('the composition scales instead of being redesigned', () => {
  // Small, standard, large, tablet - width x height in dp.
  const devices: [string, number, number][] = [
    ['small phone', 320, 568],
    ['compact', 360, 740],
    ['standard', 412, 915],
    ['large', 480, 1040],
    ['tablet', 800, 1280],
  ];

  test.each(devices)('%s: nothing collapses or runs away', (_n, w, h) => {
    const g = gaps(h, w);

    // Every gap is positive and finite - no NaN leaking from a bad fraction.
    for (const [key, value] of Object.entries(g)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(`${key}`).toBeTruthy();
    }

    // The rhythm holds its order on every device: the breath before the
    // buttons is always the largest gap, the gap between them always the
    // smallest. That ordering *is* the composition.
    expect(g.heroToButtons).toBeGreaterThan(g.logoToHero);
    expect(g.logoToHero).toBeGreaterThan(g.betweenButtons);
    expect(g.promptToLink).toBeLessThan(g.betweenButtons);
  });

  it('keeps the hero proportional but bounded', () => {
    const sizes = devices.map(([, w]) => heroSize(w));
    // Monotonic in width - a wider screen never gets smaller type.
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]!);
    }
    // Clamped at both ends so a tablet does not get a 120pt headline and a
    // small phone still gets something that reads as display type.
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(64);
  });

  it('leaves the hero room to breathe at the edges', () => {
    for (const [, w, h] of devices) {
      const g = gaps(h, w);
      // Content width after margins stays a clear majority of the screen -
      // the heading is never squeezed into a column.
      expect((w - g.edge * 2) / w).toBeGreaterThan(0.8);
    }
  });
});

describe('the written line breaks are the only line breaks', () => {
  const devices: [string, number, number][] = [
    ['small phone', 320, 568],
    ['compact', 360, 740],
    ['standard', 412, 915],
    ['tablet', 800, 1280],
  ];

  // Shared with the implementation rather than re-declared, so the test
  // cannot silently agree with a stale constant.
  const ADVANCE = HERO_ADVANCE;

  test.each(devices)('%s: every hero line fits its column', (_n, w, h) => {
    const g = gaps(h, w);
    const available = w - g.edge * 2;

    for (const lines of Object.values(COPY)) {
      const longest = lines.reduce((n: number, l: string) => Math.max(n, l.length), 0);
      const size = heroSize(w, longest, g.edge);
      // If the widest line still overflows, the hero silently gains a row and
      // the composition the copy was written for is gone.
      expect(longest * size * ADVANCE).toBeLessThanOrEqual(available + 0.5);
    }
  });

  it('shrinks for a long line rather than letting it wrap', () => {
    const short = heroSize(412, 9, 28);
    const long = heroSize(412, 22, 28);
    expect(long).toBeLessThan(short);
  });

  it('still respects the upper clamp when the line is short', () => {
    expect(heroSize(2000, 4, 28)).toBe(64);
  });

  it('leaves room for Playfair\'s descenders', () => {
    // Playfair drops about 0.21em below the baseline. A line box tighter than
    // that crops the tail of a 'y' on the last line, which is what happened
    // at 1.06.
    expect(HERO_LEADING).toBeGreaterThanOrEqual(1.15);
    // But still tight enough to read as set headline, not body copy.
    expect(HERO_LEADING).toBeLessThan(1.35);
  });

  it('measures every real headline as fitting on one line', () => {
    // The regression this guards is "Welcome bac…" - a size computed as
    // fitting that the renderer then ellipsised.
    for (const [key, lines] of Object.entries(COPY)) {
      for (const [, w, h] of [[0, 320, 568], [0, 360, 740], [0, 412, 915]] as number[][]) {
        const g = gaps(h!, w!);
        const longest = (lines as readonly string[])
          .reduce((n, l) => Math.max(n, l.length), 0);
        const size = heroSize(w!, longest, g.edge);
        const drawn = longest * size * ADVANCE;
        expect(`${key}@${w}: ${drawn <= w! - g.edge * 2}`).toBe(`${key}@${w}: true`);
      }
    }
  });
});

describe('one column width across the whole flow', () => {
  it('matches the pill buttons', () => {
    // Fields were 100% while the Google and Email pills were 88%, so moving
    // from the provider choice into the email form made everything jump
    // wider. Both now read from this.
    expect(COLUMN).toBeGreaterThan(0.8);
    expect(COLUMN).toBeLessThanOrEqual(0.92);
  });
});

/* ───────────────────── the two backdrops stay different ─────────────────── */

import { AUTH_FIELDS, SHAPE, WELCOME_FIELDS, fieldsFor, tail } from '../src/ui/auth/atmosphere';
import { GLOW } from '../src/ui/auth/authTheme';

describe('welcome and the auth screens do not share a background', () => {
  it('gives welcome a multi-field atmosphere', () => {
    // Several overlapping fields, not one gradient pretending to be one.
    expect(WELCOME_FIELDS.length).toBeGreaterThanOrEqual(8);
    expect(fieldsFor('welcome')).toBe(WELCOME_FIELDS);
  });

  it('gives login and sign up an atmosphere along the foot only', () => {
    expect(AUTH_FIELDS.length).toBeGreaterThanOrEqual(6);
    expect(fieldsFor('auth')).toBe(AUTH_FIELDS);

    for (const f of AUTH_FIELDS) {
      // Every centre below the bottom edge, so light enters from beneath and
      // fades upward - and the bright core is never drawn.
      expect(`${f.id} cy=${f.cy}`).toBe(`${f.id} cy=${f.cy}`);
      expect(f.cy).toBeGreaterThan(1);

      // Nothing reaches past the midline by much, so the upper screen stays
      // off-white without needing a mask.
      expect(f.cy - f.ry).toBeGreaterThan(0.5);
    }
  });

  it('uses exactly two hues, pink left and orange right', () => {
    const hues = new Set(AUTH_FIELDS.map((f) => f.colour));
    // Two. The apparent mauve/cream/peach range in the reference is these two
    // thinning out and crossing, not extra fields.
    expect(hues.size).toBe(2);
    expect(hues.has(GLOW.authPink)).toBe(true);
    expect(hues.has(GLOW.authOrange)).toBe(true);

    const pink = AUTH_FIELDS.filter((f) => f.colour === GLOW.authPink);
    const orange = AUTH_FIELDS.filter((f) => f.colour === GLOW.authOrange);
    expect(pink.length).toBeGreaterThanOrEqual(3);
    expect(orange.length).toBeGreaterThanOrEqual(3);

    // Pink stays left of centre, orange right of it.
    for (const f of pink) expect(f.cx).toBeLessThan(0.5);
    for (const f of orange) expect(f.cx).toBeGreaterThan(0.5);

    // Warm side begins higher up the screen than the cool side.
    const highest = (fs: typeof AUTH_FIELDS) => Math.min(...fs.map((f) => f.cy - f.ry));
    expect(highest(orange)).toBeLessThan(highest(pink));
  });

  it('lets the two hues overlap across the centre rather than drawing a blend', () => {
    const pink = AUTH_FIELDS.filter((f) => f.colour === GLOW.authPink);
    const orange = AUTH_FIELDS.filter((f) => f.colour === GLOW.authOrange);

    // At least one field per side reaches past the middle, so their tails
    // cross there. Without this the centre is a gap, and adding a third
    // colour to fill it is what produces separate washes.
    expect(pink.some((f) => f.cx + f.rx > 0.62)).toBe(true);
    expect(orange.some((f) => f.cx - f.rx < 0.38)).toBe(true);
  });

  it('stacks each side same-hue, wider meaning weaker', () => {
    for (const hue of [GLOW.authPink, GLOW.authOrange]) {
      const group = AUTH_FIELDS
        .filter((f) => f.colour === hue)
        .sort((x, y) => y.rx - x.rx);
      // Widest is palest, narrowest is strongest - that ordering is what
      // produces the value progression out of a single colour.
      for (let i = 1; i < group.length; i += 1) {
        expect(group[i]!.peak).toBeGreaterThan(group[i - 1]!.peak);
      }
    }
  });

  it('keeps the auth dome clear of the lower atmosphere it is meant to reveal', () => {
    // The dome's apex must sit below where the fields fade out, or it paints
    // over the colour it is supposed to sit in front of.
    const apex = SHAPE.auth.cy - SHAPE.auth.ry;
    const highestField = Math.min(...AUTH_FIELDS.map((f) => f.cy - f.ry));
    expect(apex).toBeGreaterThan(highestField);
    // And it stays in the lower part of the screen rather than crossing the
    // middle, so the composition above it is untouched.
    expect(apex).toBeGreaterThan(0.6);
  });

  it('centres every welcome field outside the viewport', () => {
    // A field centred on screen shows its bright core and the ring where its
    // midsection quantises. Only the long outer tail may be visible.
    for (const f of WELCOME_FIELDS) {
      const outside = f.cx < 0 || f.cx > 1 || f.cy < 0 || f.cy > 1;
      expect(`${f.id} outside: ${outside}`).toBe(`${f.id} outside: true`);
    }
  });

  it('gives every field a radius large enough to reach well inside', () => {
    // If the tail dies before it gets anywhere, the colour reads as a rim.
    for (const f of WELCOME_FIELDS) {
      expect(f.rx).toBeGreaterThan(0.8);
      expect(f.ry).toBeGreaterThan(0.3);
    }
  });

  it('covers all four outer areas', () => {
    const has = (pred: (f: { cx: number; cy: number }) => boolean) =>
      WELCOME_FIELDS.some(pred);
    expect(has((f) => f.cy < 0)).toBe(true);              // top
    expect(has((f) => f.cy > 1)).toBe(true);              // bottom
    expect(has((f) => f.cx < 0)).toBe(true);              // left
    expect(has((f) => f.cx > 1)).toBe(true);              // right
  });

  it('fades monotonically to nothing, with no step big enough to band', () => {
    const stops = tail(1);
    expect(stops[0]!.opacity).toBe(1);
    expect(stops[stops.length - 1]!.opacity).toBe(0);
    expect(stops.length).toBeGreaterThanOrEqual(8);

    for (let i = 1; i < stops.length; i += 1) {
      const prev = stops[i - 1]!;
      const cur = stops[i]!;
      // Never brightens.
      expect(cur.opacity).toBeLessThan(prev.opacity);
      // No single segment drops more than a fifth of full alpha - that is the
      // threshold where a ramp starts showing a seam on an 8-bit panel.
      expect(prev.opacity - cur.opacity).toBeLessThanOrEqual(0.2);
    }
  });

  it('draws welcome\'s shape wider than the screen', () => {
    // rx > 1 means the ellipse's own extremes are off-screen, so the visible
    // arc is the shallow middle of the curve rather than a stadium's end.
    expect(SHAPE.welcome.rx).toBeGreaterThan(1);
    // And it never fills the screen vertically - colour stays visible above
    // and below.
    expect(SHAPE.welcome.ry).toBeLessThan(0.5);
  });

  it('leaves both bottom corners coloured on the auth dome', () => {
    const { cx, cy, rx, ry } = SHAPE.auth;
    // Half-width of the dome where it crosses the bottom edge of the screen.
    const dy = (1 - cy) / ry;
    const halfWidth = rx * Math.sqrt(1 - dy * dy);

    // Narrower than the screen, so colour shows beside it in both corners -
    // as it does in the reference.
    expect(cx + halfWidth).toBeLessThan(1);
    expect(cx - halfWidth).toBeGreaterThan(0);
    // But still a broad dome, not a small circle.
    expect(halfWidth).toBeGreaterThan(0.35);
  });
});

/* ──────────────────────────────── branding ─────────────────────────────── */

import { T as TYPE } from '../src/ui/auth/authTheme';

describe('brand hierarchy', () => {
  it('sets the app name above the supporting copy', () => {
    // It was 17 against a 16px prompt, which read as a caption rather than as
    // the product's name. Hero > wordmark > supporting copy is the order.
    const wordmark = TYPE.wordmark!.fontSize as number;
    const prompt = TYPE.prompt!.fontSize as number;
    const button = TYPE.button!.fontSize as number;

    expect(wordmark).toBeGreaterThan(prompt);
    expect(wordmark).toBeGreaterThan(button);
  });

  it('keeps the wordmark well below the hero on every screen size', () => {
    const wordmark = TYPE.wordmark!.fontSize as number;
    for (const [w, e] of [[320, 23], [360, 26], [412, 30]] as number[][]) {
      // Shortest real headline, so this is the closest the two ever get.
      const hero = heroSize(w!, 8, e!);
      expect(`${w}: ${hero > wordmark * 1.5}`).toBe(`${w}: true`);
    }
  });

  it('leaves enough slack under the hero for a descender', () => {
    // The 'y' in "ready" sits on the last line, where Android crops to the
    // view bounds rather than to the glyph.
    const slack = 0.24;
    const descender = 0.21;
    expect(slack).toBeGreaterThan(descender);
  });
});
