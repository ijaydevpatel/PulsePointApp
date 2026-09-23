/**
 * The floating header: brand mark at top left, avatar at top right.
 *
 * Two separate chips rather than one bar. A full-width header reserves its
 * whole height whether or not anything is in it, and on these screens there is
 * nothing in the middle — so the band was costing about 90dp of content for a
 * logo and a circle. Floating them means the list underneath starts at the top
 * of the screen and scrolls past them.
 *
 * ── Why the chips still have a surface ───────────────────────────────────────
 *
 * Content scrolls under them, so neither can rely on the background behind it
 * staying light. Each sits on its own opaque circle: the mark keeps its own
 * colours legible, the avatar reads as a control, and neither dissolves into a
 * card or a photo passing beneath.
 *
 * ── Colour ───────────────────────────────────────────────────────────────────
 *
 * Taken from the welcome composition and the brand mark rather than from the
 * product theme, matching the tab bar. This is chrome that sits above every
 * screen including the triage result, where colour carries clinical meaning; a
 * tinted header competing with a red EMERGENCY band is a hazard rather than a
 * style choice, so the chrome stays neutral in both schemes.
 */
import React from 'react';
import {
  View, Text, StyleSheet, Pressable, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../auth/BrandMark';
import { Icon } from '../components/Icon';
import { Session } from '../../domain/auth';
import { S, TOUCH, TYPE } from '../theme';

/** Chip surface. Near-white so the mark's own colours stay true on it. */
const CHIP = '#FFFFFF';
/** The hexagon in the brand mark — the avatar circle matches the tab bar. */
const AVATAR = '#1A1A1A';
const ON_AVATAR = '#FFFFFF';
const INK = '#0A0A0A';

/**
 * Height the chips occupy, for screens that need to start their content below
 * them rather than under them. Exported so no screen has to guess.
 */
export const TOP_BAR_HEIGHT = TOUCH + S.sm * 2;

/** First letter of the display name, or a glyph when there is nothing to use. */
function initial(session: Session): string | null {
  const name = session.displayName?.trim();
  if (!name) return null;
  const ch = name[0];
  return ch ? ch.toUpperCase() : null;
}

export function TopBar({
  session, onOpenProfile, onOpenHome,
}: {
  session: Session;
  onOpenProfile: () => void;
  /** Tapping the mark returns to Home, the way a logo usually behaves. */
  onOpenHome?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const letter = initial(session);

  /*
   * On a narrow screen the wordmark is the first thing to go. The mark alone
   * still identifies the app, and keeping the text would either shrink the
   * avatar's target or push it off the edge.
   */
  const showWordmark = width >= 360;

  return (
    <View
      style={[st.wrap, { top: insets.top + S.xs }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onOpenHome}
        disabled={!onOpenHome}
        accessibilityRole={onOpenHome ? 'button' : 'image'}
        accessibilityLabel="PulsePoint"
        accessibilityHint={onOpenHome ? 'Goes to Home' : undefined}
        style={({ pressed }) => [st.brandChip, pressed && onOpenHome ? { opacity: 0.75 } : null]}
      >
        <BrandMark size={22} />
        {showWordmark ? <Text style={st.wordmark}>PulsePoint</Text> : null}
      </Pressable>

      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={session.displayName ? `Account: ${session.displayName}` : 'Account'}
        accessibilityHint="Opens records, chat, news and settings"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [st.avatar, pressed && { opacity: 0.8 }]}
      >
        {letter ? (
          <Text style={st.initial} allowFontScaling={false}>{letter}</Text>
        ) : (
          <Icon name="user" size={20} color={ON_AVATAR} />
        )}
      </Pressable>
    </View>
  );
}

/** Soft shadow shared by both chips. Low and wide — depth, not an outline. */
const LIFT = {
  shadowColor: '#0B0B0F',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 4,
} as const;

const st = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },

  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: TOUCH,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: TOUCH / 2,
    backgroundColor: CHIP,
    ...LIFT,
  },
  wordmark: {
    ...TYPE.heading,
    color: INK,
    fontSize: 15.5,
    letterSpacing: -0.3,
  },

  avatar: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    backgroundColor: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    ...LIFT,
  },
  initial: {
    ...TYPE.heading,
    color: ON_AVATAR,
    fontSize: 17,
    lineHeight: 20,
  },
});
