/**
 * Floating liquid-glass tab bar.
 *
 * Detached from the bottom edge and made of the liquid glass material, so the
 * content behind it stays partly readable rather than being hidden under a
 * chrome strip.
 *
 * The active indicator is a single circle that travels between slots — and it
 * *stretches* while it moves, then settles. That deformation is the "liquid"
 * part and it is not decoration: a rigid shape sliding across reads as a
 * selection box, whereas one that elongates with its own momentum reads as a
 * substance under tension. It is the cheapest single change that makes the
 * material feel physical rather than painted on.
 *
 * The stretch is derived from the animated position rather than fired
 * separately, so it can never desynchronise from the travel — it is literally
 * a function of how far the indicator still has to go.
 *
 * QR6 is unaffected: every slot still exceeds the 44pt minimum, and the active
 * state is carried by icon weight, label weight and the indicator together.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS, TabKey } from './routes';
import { useTheme, TYPE, S, R, TOUCH, MOTION, circle } from '../theme';
import { Icon } from '../components/Icon';
import { Springy } from '../components/Primitives';
import { LiquidGlass } from '../components/LiquidGlass';

/**
 * The active indicator sits behind the icon only, not the icon and label
 * together. A blob tall enough to cover both fills the whole bar height and
 * reads as a lozenge crowding its neighbours; a disc around the glyph reads as
 * a selected state.
 */
const DOT = 38;
const ICON = 23;
const PAD_V = S.sm + 2;

export function TabBar({ active, onSelect }: { active: TabKey; onSelect: (k: TabKey) => void }) {
  const { c: P, elev, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  const index = Math.max(0, TABS.findIndex((t) => t.key === active));
  const [slot, setSlot] = useState(0);

  /** Animated slot position, in slots rather than pixels. */
  const pos = useRef(new Animated.Value(index)).current;
  /** Where the travel started, so stretch can be measured against distance. */
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

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const next = w / TABS.length;
    if (Math.abs(next - slot) > 0.5) setSlot(next);
  };

  /*
    Stretch: 1 at either end of the journey, widest in the middle. Built by
    interpolating the *same* animated value that drives translation, so the
    deformation is exactly in phase with the movement.
  */
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

  const translateX = slot > 0
    ? pos.interpolate({
        inputRange: [0, 1],
        outputRange: [0, slot],
      })
    : 0;

  return (
    <View
      style={[
        st.wrap,
        { bottom: Math.max(insets.bottom, S.sm) + S.xs, left: S.lg, right: S.lg },
        /*
         * Deliberately not elev(3). Android draws elevation as a real shadow,
         * and at elevation 14 on a rounded shape it collapses into a hard dark
         * ring hugging the edge — which read as a black outline round the
         * capsule rather than as depth. A wide, low-opacity shadow lifts the
         * bar without drawing a line around it.
         */
        {
          shadowColor: '#000',
          shadowOpacity: scheme === 'dark' ? 0.44 : 0.10,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
      ]}
      pointerEvents="box-none"
    >
      <LiquidGlass radius={R.pill} style={st.bar}>
        <View style={st.row} onLayout={onLayout} accessibilityRole="tablist">
          {slot > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                st.dot,
                circle(DOT),
                {
                  left: (slot - DOT) / 2,
                  // Aligned to the icon, not the centre of the whole slot.
                  top: PAD_V + ICON / 2 - DOT / 2,
                  /*
                   * A soft tint, no border. The bordered version read as an
                   * opaque lavender chip pasted onto the glass — a solid object
                   * sitting on the material rather than a highlight within it.
                   */
                  backgroundColor: P.accent + (scheme === 'dark' ? '2B' : '16'),
                  transform: [
                    { translateX },
                    { scaleX: stretchX },
                    { scaleY: squashY },
                  ],
                },
              ]}
            />
          ) : null}

          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <Springy
                key={t.key}
                onPress={() => onSelect(t.key)}
                weight="select"
                scaleTo={0.88}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: on }}
                style={st.tab}
              >
                <Icon
                  name={t.icon}
                  size={ICON}
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
  row: { flexDirection: 'row', paddingVertical: PAD_V, paddingHorizontal: S.xs },
  dot: { position: 'absolute' },
  tab: {
    flex: 1,
    minHeight: TOUCH + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
