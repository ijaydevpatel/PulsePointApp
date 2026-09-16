/**
 * Floating liquid-glass tab bar.
 *
 * ── How the active indicator is positioned, and why it changed ───────────────
 *
 * It used to be placed by arithmetic: measure the row, divide by the tab count,
 * offset by the padding, subtract half the indicator. That is three assumptions
 * about layout, and it was wrong twice — first because onLayout reports the box
 * *including* padding while the tabs sit inside it, then again once the icon
 * offset was folded in.
 *
 * It is now positioned from measurement instead of derivation: every tab
 * reports its own x and width via onLayout, and the indicator simply adopts
 * them. There is no padding term, no divide, and nothing to get wrong — if the
 * tab moves, the indicator moves with it by definition.
 *
 * The indicator is also a capsule behind the whole item rather than a circle
 * around the glyph. A circle has to be centred on *something* — the icon, or
 * the item, or the slot — and those three differ. A capsule that adopts the
 * tab's own bounds has no such ambiguity.
 *
 * The stretch on travel is kept: it is interpolated from the same animated
 * value that drives translation, so the deformation cannot fall out of sync
 * with the movement.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS, TabKey } from './routes';
import { useTheme, TYPE, S, R, TOUCH, MOTION } from '../theme';
import { Icon } from '../components/Icon';
import { Springy } from '../components/Primitives';
import { LiquidGlass } from '../components/LiquidGlass';

const PAD_V = S.sm + 2;
const PAD_H = S.xs;
/** Inset of the capsule inside the tab's measured bounds. */
const GAP = 5;

interface Slot { x: number; w: number }

export function TabBar({ active, onSelect }: { active: TabKey; onSelect: (k: TabKey) => void }) {
  const { c: P, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const index = Math.max(0, TABS.findIndex((t) => t.key === active));
  const [slots, setSlots] = useState<Slot[]>([]);
  const measured = slots.length === TABS.length && slots.every((s) => s && s.w > 0);

  /** Animated position, in tab index units. */
  const pos = useRef(new Animated.Value(index)).current;
  const from = useRef(index);

  useEffect(() => {
    Animated.spring(pos, {
      toValue: index,
      damping: MOTION.liquid.damping,
      stiffness: MOTION.liquid.stiffness,
      mass: 1,
      useNativeDriver: true,
    }).start(() => { from.current = index; });
  }, [index, pos]);

  const onTabLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setSlots((prev) => {
      const cur = prev[i];
      if (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.w - width) < 0.5) return prev;
      const next = [...prev];
      next[i] = { x, w: width };
      return next;
    });
  };

  const a = Math.min(from.current, index);
  const b = Math.max(from.current, index);
  const moving = b > a;

  const stretchX = moving
    ? pos.interpolate({
        inputRange: [a, (a + b) / 2, b],
        outputRange: [1, MOTION.liquid.stretch, 1],
        extrapolate: 'clamp',
      })
    : 1;
  const squashY = moving
    ? pos.interpolate({
        inputRange: [a, (a + b) / 2, b],
        outputRange: [1, MOTION.liquid.squash, 1],
        extrapolate: 'clamp',
      })
    : 1;

  /*
   * Translation interpolates across the measured x of every tab, so the
   * indicator tracks real positions even if the tabs are unequal widths.
   */
  const translateX = measured
    ? pos.interpolate({
        inputRange: TABS.map((_, i) => i),
        outputRange: slots.map((s) => s.x + GAP),
      })
    : 0;

  const capsuleW = measured ? slots[index]!.w - GAP * 2 : 0;

  return (
    <View
      style={[
        st.wrap,
        { bottom: Math.max(insets.bottom, S.sm) + S.xs, left: S.lg, right: S.lg },
        /*
         * Android draws elevation as a real shadow; at high values on a rounded
         * shape it collapses into a hard dark ring that reads as an outline
         * rather than depth. Wide and low-opacity instead.
         */
        {
          shadowColor: '#000',
          shadowOpacity: scheme === 'dark' ? 0.44 : 0.10,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 4,
        },
      ]}
      pointerEvents="box-none"
    >
      <LiquidGlass radius={R.pill} style={st.bar}>
        <View style={st.row} accessibilityRole="tablist">
          {measured ? (
            <Animated.View
              pointerEvents="none"
              style={[
                st.capsule,
                {
                  width: capsuleW,
                  backgroundColor: P.accent + (scheme === 'dark' ? '2E' : '18'),
                  transform: [
                    { translateX },
                    { scaleX: stretchX },
                    { scaleY: squashY },
                  ],
                },
              ]}
            />
          ) : null}

          {TABS.map((t, i) => {
            const on = t.key === active;
            return (
              <View key={t.key} style={{ flex: 1 }} onLayout={onTabLayout(i)}>
                <Springy
                  onPress={() => onSelect(t.key)}
                  weight="select"
                  scaleTo={0.9}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: on }}
                  style={st.tab}
                >
                  <Icon
                    name={t.icon}
                    size={23}
                    color={on ? P.accent : P.muted}
                    weight={on ? 'bold' : 'regular'}
                  />
                  <Animated.Text
                    numberOfLines={1}
                    style={[
                      TYPE.micro,
                      { color: on ? P.accent : P.muted, fontSize: 10.5, marginTop: 3 },
                    ]}
                  >
                    {t.label}
                  </Animated.Text>
                </Springy>
              </View>
            );
          })}
        </View>
      </LiquidGlass>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute' },
  bar: { borderRadius: R.pill },
  row: { flexDirection: 'row', paddingVertical: PAD_V, paddingHorizontal: PAD_H },
  capsule: {
    position: 'absolute',
    left: 0,
    top: GAP,
    bottom: GAP,
    borderRadius: R.pill,
  },
  tab: {
    minHeight: TOUCH + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
