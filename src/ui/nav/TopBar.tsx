import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Session } from '../../domain/auth';
import { S, TOUCH, TYPE } from '../theme';

const AVATAR = '#1A1A1A';
const ON_AVATAR = '#FFFFFF';

export const TOP_BAR_HEIGHT = TOUCH + S.sm * 2;

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
