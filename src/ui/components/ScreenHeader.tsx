import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, S, T, TOUCH } from '../theme';

export function ScreenHeader({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode;
}) {
  return (
    <View style={s.wrap}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back"
          onPress={onBack} style={s.back} hitSlop={8}>
          <View style={s.chev} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={T.display} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[T.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** QR2 made visible: offline is a state the app supports, not an error it reports. */
export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={s.offline} accessibilityRole="alert">
      <View style={s.dot} />
      <Text style={s.offlineText}>Offline — triage and medicines still work</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
    paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.lg,
  },
  back: { minWidth: TOUCH, minHeight: TOUCH, alignItems: 'flex-start', justifyContent: 'center' },
  chev: {
    width: 11, height: 11, borderLeftWidth: 2.2, borderBottomWidth: 2.2,
    borderColor: C.ink, transform: [{ rotate: '45deg' }],
  },
  offline: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: '#FFF8E6', borderBottomWidth: 1, borderBottomColor: '#F5E2B0',
    paddingHorizontal: S.xl, paddingVertical: S.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B7791F' },
  offlineText: { fontSize: 12.5, fontWeight: '600', color: '#7A5B12' },
});
