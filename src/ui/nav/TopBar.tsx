/**
 * The floating header: the account avatar, and nothing else.
 *
 * ── Why the brand lockup went ────────────────────────────────────────────────
 *
 * It sat at the top left of every tab - mark plus wordmark - telling the
 * person the name of the app they had just opened and were already looking
 * at. That is a splash screen's job, and there is one now. On a phone the top
 * strip is the most expensive space there is, and a logo is the weakest thing
 * to spend it on.
 *
 * The chip was also the way back to Home. That is not lost: the tab bar has a
 * Home tab, which is where people reach for it, and Android's back gesture
 * still unwinds the stack.
 *
 * ── Why the avatar still has a surface ───────────────────────────────────────
 *
 * Content scrolls under it, so it cannot rely on the background behind it
 * staying light. It sits on its own opaque circle, so it reads as a control
 * rather than dissolving into a card passing beneath.
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
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Session } from '../../domain/auth';
import { S, TOUCH, TYPE } from '../theme';

/** The hexagon in the brand mark - the avatar circle matches the tab bar. */
const AVATAR = '#1A1A1A';
const ON_AVATAR = '#FFFFFF';

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

export function TopBar({ session, onOpenProfile }: {
  session: Session;
  onOpenProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const letter = initial(session);

  return (
    <View
      style={[st.wrap, { top: insets.top + S.xs }]}
      pointerEvents="box-none"
    >
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

/** Soft shadow shared by both chips. Low and wide - depth, not an outline. */
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
    justifyContent: 'flex-end',
    zIndex: 10,
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
