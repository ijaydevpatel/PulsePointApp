import { TextStyle } from 'react-native';
import { FONT } from '../theme';

export const C = {
  canvas: '#F7F7F9',

  surface: '#FFFFFF',

  ink: '#0A0A0A',

  ink2: '#222222',

  ink3: '#6B6B70',

  accent: '#A6572B',

  accentSoft: '#D88B63',

  danger: '#A3342A',

  field: '#8E8E95',

  hair: '#ECECEF',
} as const;

export const GLOW = {
  cream: '#FDF7EE',

  peachLight: '#F6D5BD',

  peach: '#F2B38F',

  orange: '#EAA16C',

  amber: '#E7A15F',

  blush: '#F2C1D2',

  pink: '#E8A8C4',

  pinkLight: '#F3D1DD',

  authPink: '#E8AECF',
  authOrange: '#F0A45C',
} as const;

export function gaps(height: number, width: number) {
  const v = (fraction: number, min: number, max: number) =>
    Math.round(Math.max(min, Math.min(max, height * fraction)));

  return {
    top: v(0.055, 32, 72),

    logoToHero: v(0.048, 28, 60),

    heroToButtons: v(0.070, 40, 88),

    betweenButtons: v(0.017, 12, 20),

    buttonsToSwitcher: v(0.058, 34, 72),

    promptToLink: v(0.010, 7, 12),

    heroToForm: v(0.046, 28, 58),

    edge: Math.round(Math.max(20, Math.min(40, width * 0.072))),
  };
}

export type Gaps = ReturnType<typeof gaps>;

export const COLUMN = 0.88;

export const HERO_ADVANCE = 0.58;

export const HERO_LEADING = 1.18;

export function heroSize(width: number, longestLine = 12, edge = 28): number {
  const proportional = width * 0.148;
  const available = width - edge * 2;
  const fitsOnOneLine = available / (Math.max(1, longestLine) * HERO_ADVANCE);

  return Math.floor(Math.max(18, Math.min(64, proportional, fitsOnOneLine)));
}

export const T: Record<string, TextStyle> = {
  hero: {
    fontFamily: FONT.serif,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    includeFontPadding: false,
  },

  button: { fontFamily: FONT.medium, fontSize: 16.5, letterSpacing: -0.1, color: C.ink },
  cta: { fontFamily: FONT.semibold, fontSize: 15, letterSpacing: 1.4, color: C.ink },
  prompt: { fontFamily: FONT.regular, fontSize: 16, color: C.ink2 },
  link: { fontFamily: FONT.medium, fontSize: 16, color: C.accent, textDecorationLine: 'underline' },
  label: { fontFamily: FONT.medium, fontSize: 14, color: C.ink2, letterSpacing: 0.1 },
  input: { fontFamily: FONT.regular, fontSize: 16, color: C.ink },
  error: { fontFamily: FONT.regular, fontSize: 13.5, color: C.danger, lineHeight: 19 },

  wordmark: { fontFamily: FONT.bold, fontSize: 22, letterSpacing: -0.4, color: C.ink },
};

export const LIFT = {
  shadowColor: '#2A2118',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export const COPY = {
  welcomeHero: ['Welcome.', 'Your health picture', 'is ready.'],
  loginHero: ['Your health,', 'clearly read.'],
  signupHero: ['Start your', 'health record.'],

  emailLoginHero: ['Welcome', 'back.'],
  emailSignupHero: ['Create your', 'account.'],
} as const;
