import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { C, S, R, T, TOUCH, SHADOW } from '../theme';

export function Card({ children, style, onPress }:
  { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[st.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      {inner}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={[T.section, { marginBottom: S.md }]}>{children}</Text>;
}

export function Button({ title, onPress, tone = 'primary', disabled, busy }: {
  title: string; onPress: () => void;
  tone?: 'primary' | 'quiet' | 'danger'; disabled?: boolean; busy?: boolean;
}) {
  const bg = tone === 'primary' ? C.accent : tone === 'danger' ? C.danger : 'transparent';
  const fg = tone === 'quiet' ? C.accent : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderWidth: tone === 'quiet' ? 1.5 : 0, borderColor: C.accent },
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[st.btnText, { color: fg }]}>{busy ? 'Working…' : title}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body, action }:
  { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={st.empty}>
      <Text style={[T.bodyStrong, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[T.caption, { textAlign: 'center', marginTop: S.sm, maxWidth: 300 }]}>{body}</Text>
      {action ? <View style={{ marginTop: S.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Shown when a feature lands in a later phase. Honest rather than a dead button. */
export function PhaseNotice({ phase, what }: { phase: number; what: string }) {
  return (
    <View style={st.phase}>
      <Text style={[T.caption, { color: C.accent, fontWeight: '700' }]}>PHASE {phase}</Text>
      <Text style={[T.caption, { marginTop: 2 }]}>{what}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: R.lg, padding: S.lg,
    borderWidth: 1, borderColor: C.line, ...SHADOW.card,
  },
  btn: {
    minHeight: TOUCH + 6, borderRadius: R.md,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl,
  },
  btnText: { fontSize: 16.5, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: S.xxxl * 1.4, paddingHorizontal: S.xl },
  phase: {
    backgroundColor: C.accentSoft, borderRadius: R.md, padding: S.md,
    borderLeftWidth: 3, borderLeftColor: C.accent,
  },
});
