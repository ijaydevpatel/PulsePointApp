/**
 * iOS 26 navigation.
 *
 * The structural change from iOS 18 is that the bar stops being a bar. In 18 a
 * navigation bar is an opaque strip that owns the top of the screen and content
 * begins below it. In 26 the content runs edge to edge underneath, and the
 * controls float on top of it as *separate* pieces of glass — a circle for
 * back, a capsule for the title, a circle for actions — each with its own rim
 * and its own shadow, with the live content visible in the gaps between them.
 *
 * That separation is the whole effect. A single full-width glass strip still
 * reads as iOS 18 with a blur applied; discrete floating capsules read as 26.
 *
 * The title capsule only materialises once the large title has scrolled away,
 * so at rest the top of the screen is just content and a back button.
 */
import React, { ReactNode } from 'react';
import { View, Animated, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TYPE, S, R, ROW_INSET, TOUCH } from '../theme';
import { Icon } from './Icon';
import { Txt, tap } from './Primitives';
import { LiquidGlass, GlassCircle } from './LiquidGlass';

/** Scroll distance over which the title swaps. iOS uses a short throw. */
const SWAP = 26;
const BAR_H = 46;

export function useNavScroll() {
  const y = React.useRef(new Animated.Value(0)).current;
  const onScroll = React.useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true }),
    [y],
  );
  return { y, onScroll, scrollEventThrottle: 16 };
}

export function NavBar({
  title, y, onBack, right,
}: {
  title: string;
  y: Animated.Value;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { c: P } = useTheme();
  const insets = useSafeAreaInsets();

  const inline = y.interpolate({
    inputRange: [SWAP * 0.5, SWAP * 1.7],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // The capsule rises slightly as it appears, rather than simply fading.
  const rise = y.interpolate({
    inputRange: [SWAP * 0.5, SWAP * 1.7],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      pointerEvents="box-none"
      style={[st.layer, { paddingTop: insets.top + 4, height: insets.top + BAR_H + 8 }]}
    >
      <View style={st.row} pointerEvents="box-none">
        <View style={st.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              onPressIn={() => tap('light')}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              {/* Its own piece of glass, not a chevron on a shared strip. */}
              <GlassCircle size={38}>
                <Icon name="chevronLeft" size={19} color={P.accent} weight="bold" />
              </GlassCircle>
            </Pressable>
          ) : null}
        </View>

        <Animated.View
          pointerEvents="none"
          style={{ opacity: inline, transform: [{ translateY: rise }] }}
        >
          <LiquidGlass
            radius={R.pill}
            edgeWidth={7}
            contentStyle={st.titleInner}
          >
            <Animated.Text numberOfLines={1} style={[TYPE.headline, { color: P.ink }]}>
              {title}
            </Animated.Text>
          </LiquidGlass>
        </Animated.View>

        <View style={[st.side, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
    </View>
  );
}

/**
 * The large title. Lives inside the scroll view so it scrolls away naturally
 * rather than being animated upward — which is how iOS does it, and why the
 * movement stays smooth at any scroll speed.
 */
export function LargeTitle({
  title, subtitle, y,
}: { title: string; subtitle?: string; y: Animated.Value }) {
  const { c: P } = useTheme();

  const fade = y.interpolate({
    inputRange: [0, SWAP],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[st.large, { opacity: fade }]}>
      <Txt t="largeTitle" c={P.ink}>{title}</Txt>
      {subtitle ? (
        <Txt t="subhead" c={P.muted} style={{ marginTop: 4 }}>{subtitle}</Txt>
      ) : null}
    </Animated.View>
  );
}

/** Height a scroll view must leave clear beneath the floating controls. */
export function useNavInset() {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_H + 8;
}

const st = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_INSET - 4,
    height: BAR_H,
  },
  side: { minWidth: 44, justifyContent: 'center' },
  titleInner: {
    paddingHorizontal: S.xl,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  large: { paddingHorizontal: ROW_INSET + 2, paddingTop: S.sm, paddingBottom: S.xl },
});
