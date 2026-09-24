/**
 * iOS slider.
 *
 * Continuous drag with a shadowed round knob on a two-tone track - the filled
 * portion in the accent colour, the remainder in a light fill. Tapping anywhere
 * on the track jumps to that position, which iOS supports and most
 * reimplementations forget.
 *
 * Uses PanResponder rather than a gesture library because the app has no
 * gesture dependency and does not need one for a single control. The value is
 * held in a ref during the drag so every move event does not trigger a React
 * render - with a live glass preview attached, re-rendering per frame would
 * make the drag stutter on exactly the devices the effect is heaviest on.
 */
import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, PanResponder, LayoutChangeEvent, ViewStyle, StyleProp,
} from 'react-native';
import { useTheme, TOUCH } from '../theme';
import { tap } from './Primitives';

const KNOB = 28;

export function Slider({
  value, onChange, onSettle, minimumTrack, style, accessibilityLabel,
}: {
  value: number;                       // 0..1
  onChange: (v: number) => void;
  /** Fired once at the end of a drag, for anything expensive to persist. */
  onSettle?: (v: number) => void;
  minimumTrack?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}) {
  const { c: P, scheme } = useTheme();
  const [w, setW] = useState(0);
  const width = useRef(0);
  const current = useRef(value);
  current.current = value;

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const fromX = (x: number) => clamp(width.current > 0 ? x / width.current : 0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        tap('select');
        onChange(fromX(e.nativeEvent.locationX));
      },
      onPanResponderMove: (_e, g) => {
        // moveX is window-relative; subtract the track's own offset.
        onChange(fromX(g.moveX - offset.current));
      },
      onPanResponderRelease: () => {
        tap('light');
        onSettle?.(current.current);
      },
    }),
  ).current;

  const offset = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    width.current = next;
    setW(next);
  };

  const filled = clamp(value) * w;

  return (
    <View
      style={[{ height: TOUCH, justifyContent: 'center' }, style]}
      onLayout={onLayout}
      // Window offset, needed because PanResponder move events are absolute.
      onTouchStart={(e) => {
        offset.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      {...pan.panHandlers}
    >
      <View style={[st.track, { backgroundColor: scheme === 'dark' ? '#39393D' : '#E9E9EA' }]}>
        <View
          style={[
            st.fill,
            { width: filled, backgroundColor: minimumTrack ?? P.accent },
          ]}
        />
      </View>

      <View
        pointerEvents="none"
        style={[
          st.knob,
          { left: Math.max(0, Math.min(w - KNOB, filled - KNOB / 2)) },
        ]}
      />
    </View>
  );
}

const st = StyleSheet.create({
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  knob: {
    position: 'absolute',
    width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
