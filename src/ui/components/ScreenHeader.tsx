import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, S, TOUCH } from '../theme';
import { GlassCircle } from './LiquidGlass';
import { Icon } from './Icon';
import { Springy, Txt, Enter } from './Primitives';

export function ScreenHeader({
  title, subtitle, onBack, right, large = true,
}: {
  title: string; subtitle?: string; onBack?: () => void;
  right?: ReactNode; large?: boolean;
}) {
  const { c: P } = useTheme();
  return (
    <Enter>
      <View style={s.wrap}>
        {onBack ? (
          <Springy onPress={onBack} scaleTo={0.88} accessibilityLabel="Go back">
            <GlassCircle size={TOUCH}>
              <Icon name="chevronLeft" size={20} color={P.ink} />
            </GlassCircle>
          </Springy>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt t={large ? 'display' : 'title'} numberOfLines={2}>{title}</Txt>
          {subtitle ? <Txt t="caption" style={{ marginTop: 4 }}>{subtitle}</Txt> : null}
        </View>
        {right}
      </View>
    </Enter>
  );
}

/** QR2 made visible: offline is a state the app supports, not an error it reports. */
export function OfflineBanner({ visible }: { visible: boolean }) {
  const { c: P } = useTheme();
  if (!visible) return null;
  return (
    <View
      style={[s.offline, { backgroundColor: P.warn + '1A', borderBottomColor: P.warn + '33' }]}
      accessibilityRole="alert"
    >
      <View style={[s.dot, { backgroundColor: P.warn }]} />
      <Txt t="micro" c={P.warn}>Offline — triage and medicines still work</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.lg,
  },
  offline: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: S.xl, paddingVertical: S.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
