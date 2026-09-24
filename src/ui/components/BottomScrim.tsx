/**
 * Fade at the bottom of the screen, behind the floating tab bar.
 *
 * Without it, content scrolls into the gap beneath the detached bar and stops
 * dead at the screen edge - half a symptom row sitting in open space under the
 * pill. That gap is what makes a floating bar look unfinished rather than
 * deliberate.
 *
 * A gradient to the canvas colour rather than a blur: masking a blur to a
 * gradient is not something React Native can do without a shader, and a hard
 * edged blur band would be more obvious than the problem it fixes. Fading to
 * the exact canvas colour means content dissolves into the background, so the
 * bar appears to sit on a surface that continues past it.
 *
 * The stops are eased rather than linear. A straight ramp reads as a visible
 * band; concentrating the change in the lower half keeps the transition
 * invisible while still fully hiding the cut-off.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme, TAB_CLEARANCE } from '../theme';

/** '#RRGGBB' → 'rgb(r,g,b)', so the gradient can vary only its alpha. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r},${g},${b})`;
}

export function BottomScrim({ height = TAB_CLEARANCE + 56 }: { height?: number }) {
  const { c: P } = useTheme();
  const c = rgb(P.bg);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { height }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c} stopOpacity="0" />
            <Stop offset="0.35" stopColor={c} stopOpacity="0.55" />
            <Stop offset="0.62" stopColor={c} stopOpacity="0.88" />
            <Stop offset="0.82" stopColor={c} stopOpacity="1" />
            <Stop offset="1" stopColor={c} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
