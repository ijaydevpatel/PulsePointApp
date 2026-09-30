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
  value: number;
  onChange: (v: number) => void;

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
