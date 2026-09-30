import { C } from '../src/ui/auth/authTheme';
import {
  confirmError, emailError, humanAuthError, nameError, passwordError,
} from '../src/ui/auth/authErrors';

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
    expect(ratio(C.field, C.surface)).toBeGreaterThanOrEqual(3);
  });

  test('the decorative accent is never promoted to text', () => {
    expect(ratio(C.accentSoft, C.canvas)).toBeLessThan(4.5);
    expect(C.accent).not.toBe(C.accentSoft);
  });
});

describe('no raw provider error reaches the person', () => {
  const RAW = 'ClerkAPIError: form_password_pwned at /v1/client/sign_ups';

  it('maps known Clerk codes to plain language', () => {
    expect(humanAuthError({ errors: [{ code: 'form_password_incorrect' }] }))
      .toBe('Incorrect email or password.');
    expect(humanAuthError({ errors: [{ code: 'form_identifier_exists' }] }))
      .toBe('This email is already registered.');
  });

  it('does not distinguish unknown email from wrong password', () => {
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

import { COLUMN, COPY, HERO_ADVANCE, HERO_LEADING, gaps, heroSize } from '../src/ui/auth/authTheme';

describe('the composition scales instead of being redesigned', () => {
  const devices: [string, number, number][] = [
    ['small phone', 320, 568],
    ['compact', 360, 740],
    ['standard', 412, 915],
    ['large', 480, 1040],
    ['tablet', 800, 1280],
  ];

  test.each(devices)('%s: nothing collapses or runs away', (_n, w, h) => {
    const g = gaps(h, w);

    for (const [key, value] of Object.entries(g)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(`${key}`).toBeTruthy();
    }

    expect(g.heroToButtons).toBeGreaterThan(g.logoToHero);
    expect(g.logoToHero).toBeGreaterThan(g.betweenButtons);
    expect(g.promptToLink).toBeLessThan(g.betweenButtons);
  });

  it('keeps the hero proportional but bounded', () => {
    const sizes = devices.map(([, w]) => heroSize(w));

    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]!);
    }

    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(64);
  });

  it('leaves the hero room to breathe at the edges', () => {
    for (const [, w, h] of devices) {
      const g = gaps(h, w);

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

  const ADVANCE = HERO_ADVANCE;

  test.each(devices)('%s: every hero line fits its column', (_n, w, h) => {
    const g = gaps(h, w);
    const available = w - g.edge * 2;

    for (const lines of Object.values(COPY)) {
      const longest = lines.reduce((n: number, l: string) => Math.max(n, l.length), 0);
      const size = heroSize(w, longest, g.edge);

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
    expect(HERO_LEADING).toBeGreaterThanOrEqual(1.15);

    expect(HERO_LEADING).toBeLessThan(1.35);
  });

  it('measures every real headline as fitting on one line', () => {
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
    expect(COLUMN).toBeGreaterThan(0.8);
    expect(COLUMN).toBeLessThanOrEqual(0.92);
  });
});

import { AUTH_FIELDS, SHAPE, WELCOME_FIELDS, fieldsFor, tail } from '../src/ui/auth/atmosphere';
import { GLOW } from '../src/ui/auth/authTheme';

describe('welcome and the auth screens do not share a background', () => {
  it('gives welcome a multi-field atmosphere', () => {
    expect(WELCOME_FIELDS.length).toBeGreaterThanOrEqual(8);
    expect(fieldsFor('welcome')).toBe(WELCOME_FIELDS);
  });

  it('gives login and sign up an atmosphere along the foot only', () => {
    expect(AUTH_FIELDS.length).toBeGreaterThanOrEqual(6);
    expect(fieldsFor('auth')).toBe(AUTH_FIELDS);

    for (const f of AUTH_FIELDS) {
      expect(`${f.id} cy=${f.cy}`).toBe(`${f.id} cy=${f.cy}`);
      expect(f.cy).toBeGreaterThan(1);

      expect(f.cy - f.ry).toBeGreaterThan(0.5);
    }
  });

  it('uses exactly two hues, pink left and orange right', () => {
    const hues = new Set(AUTH_FIELDS.map((f) => f.colour));

    expect(hues.size).toBe(2);
    expect(hues.has(GLOW.authPink)).toBe(true);
    expect(hues.has(GLOW.authOrange)).toBe(true);

    const pink = AUTH_FIELDS.filter((f) => f.colour === GLOW.authPink);
    const orange = AUTH_FIELDS.filter((f) => f.colour === GLOW.authOrange);
    expect(pink.length).toBeGreaterThanOrEqual(3);
    expect(orange.length).toBeGreaterThanOrEqual(3);

    for (const f of pink) expect(f.cx).toBeLessThan(0.5);
    for (const f of orange) expect(f.cx).toBeGreaterThan(0.5);

    const highest = (fs: typeof AUTH_FIELDS) => Math.min(...fs.map((f) => f.cy - f.ry));
    expect(highest(orange)).toBeLessThan(highest(pink));
  });

  it('lets the two hues overlap across the centre rather than drawing a blend', () => {
    const pink = AUTH_FIELDS.filter((f) => f.colour === GLOW.authPink);
    const orange = AUTH_FIELDS.filter((f) => f.colour === GLOW.authOrange);

    expect(pink.some((f) => f.cx + f.rx > 0.62)).toBe(true);
    expect(orange.some((f) => f.cx - f.rx < 0.38)).toBe(true);
  });

  it('stacks each side same-hue, wider meaning weaker', () => {
    for (const hue of [GLOW.authPink, GLOW.authOrange]) {
      const group = AUTH_FIELDS
        .filter((f) => f.colour === hue)
        .sort((x, y) => y.rx - x.rx);

      for (let i = 1; i < group.length; i += 1) {
        expect(group[i]!.peak).toBeGreaterThan(group[i - 1]!.peak);
      }
    }
  });

  it('keeps the auth dome clear of the lower atmosphere it is meant to reveal', () => {
    const apex = SHAPE.auth.cy - SHAPE.auth.ry;
    const highestField = Math.min(...AUTH_FIELDS.map((f) => f.cy - f.ry));
    expect(apex).toBeGreaterThan(highestField);

    expect(apex).toBeGreaterThan(0.6);
  });

  it('centres every welcome field outside the viewport', () => {
    for (const f of WELCOME_FIELDS) {
      const outside = f.cx < 0 || f.cx > 1 || f.cy < 0 || f.cy > 1;
      expect(`${f.id} outside: ${outside}`).toBe(`${f.id} outside: true`);
    }
  });

  it('gives every field a radius large enough to reach well inside', () => {
    for (const f of WELCOME_FIELDS) {
      expect(f.rx).toBeGreaterThan(0.8);
      expect(f.ry).toBeGreaterThan(0.3);
    }
  });

  it('covers all four outer areas', () => {
    const has = (pred: (f: { cx: number; cy: number }) => boolean) =>
      WELCOME_FIELDS.some(pred);
    expect(has((f) => f.cy < 0)).toBe(true);
    expect(has((f) => f.cy > 1)).toBe(true);
    expect(has((f) => f.cx < 0)).toBe(true);
    expect(has((f) => f.cx > 1)).toBe(true);
  });

  it('fades monotonically to nothing, with no step big enough to band', () => {
    const stops = tail(1);
    expect(stops[0]!.opacity).toBe(1);
    expect(stops[stops.length - 1]!.opacity).toBe(0);
    expect(stops.length).toBeGreaterThanOrEqual(8);

    for (let i = 1; i < stops.length; i += 1) {
      const prev = stops[i - 1]!;
      const cur = stops[i]!;

      expect(cur.opacity).toBeLessThan(prev.opacity);

      expect(prev.opacity - cur.opacity).toBeLessThanOrEqual(0.2);
    }
  });

  it('draws welcome\'s shape wider than the screen', () => {
    expect(SHAPE.welcome.rx).toBeGreaterThan(1);

    expect(SHAPE.welcome.ry).toBeLessThan(0.5);
  });

  it('leaves both bottom corners coloured on the auth dome', () => {
    const { cx, cy, rx, ry } = SHAPE.auth;

    const dy = (1 - cy) / ry;
    const halfWidth = rx * Math.sqrt(1 - dy * dy);

    expect(cx + halfWidth).toBeLessThan(1);
    expect(cx - halfWidth).toBeGreaterThan(0);

    expect(halfWidth).toBeGreaterThan(0.35);
  });
});

import { T as TYPE } from '../src/ui/auth/authTheme';

describe('brand hierarchy', () => {
  it('sets the app name above the supporting copy', () => {
    const wordmark = TYPE.wordmark!.fontSize as number;
    const prompt = TYPE.prompt!.fontSize as number;
    const button = TYPE.button!.fontSize as number;

    expect(wordmark).toBeGreaterThan(prompt);
    expect(wordmark).toBeGreaterThan(button);
  });

  it('keeps the wordmark well below the hero on every screen size', () => {
    const wordmark = TYPE.wordmark!.fontSize as number;
    for (const [w, e] of [[320, 23], [360, 26], [412, 30]] as number[][]) {
      const hero = heroSize(w!, 8, e!);
      expect(`${w}: ${hero > wordmark * 1.5}`).toBe(`${w}: true`);
    }
  });

  it('leaves enough slack under the hero for a descender', () => {
    const slack = 0.24;
    const descender = 0.21;
    expect(slack).toBeGreaterThan(descender);
  });
});
