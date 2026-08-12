import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TABS, TabKey, TabDef } from './routes';
import { C, S, T, TOUCH } from '../theme';

/** Glyphs drawn with plain Views — no icon font, nothing to download. */
function Glyph({ kind, active }: { kind: TabDef['glyph']; active: boolean }) {
  const c = active ? C.accent : C.faint;
  const bar = (h: number, key: number) => (
    <View key={key} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: c }} />
  );
  switch (kind) {
    case 'pulse':
      return <View style={g.row}>{[8, 16, 22, 12, 6].map((h, i) => bar(h, i))}</View>;
    case 'pill':
      return <View style={[g.pill, { borderColor: c }]}><View style={[g.pillHalf, { backgroundColor: c }]} /></View>;
    case 'pin':
      return (
        <View style={g.center}>
          <View style={[g.pinHead, { borderColor: c }]} />
          <View style={{ width: 2, height: 7, backgroundColor: c, marginTop: -1 }} />
        </View>
      );
    case 'rows':
      return (
        <View style={{ gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: c }} />
          ))}
        </View>
      );
    case 'dots':
      return (
        <View style={[g.row, { gap: 4 }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
          ))}
        </View>
      );
  }
}

export function TabBar({ active, onSelect }:
  { active: TabKey; onSelect: (k: TabKey) => void }) {
  return (
    <View style={s.bar} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            onPress={() => onSelect(t.key)}
            style={s.tab}
          >
            <Glyph kind={t.glyph} active={on} />
            <Text style={[s.label, on && { color: C.accent, fontWeight: '700' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const g = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2.5 },
  center: { alignItems: 'center' },
  pill: { width: 22, height: 13, borderRadius: 7, borderWidth: 2, overflow: 'hidden', transform: [{ rotate: '-35deg' }] },
  pillHalf: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9 },
  pinHead: { width: 14, height: 14, borderRadius: 8, borderWidth: 2.2 },
});

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: S.sm, paddingBottom: S.xs,
  },
  tab: { flex: 1, minHeight: TOUCH + 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { ...T.caption, fontSize: 11.5, color: C.faint },
});
