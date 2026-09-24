/**
 * Liquid glass material.
 *
 * ── The rendering constraint that shapes this file ───────────────────────────
 *
 * react-native-svg on Android renders gradient **fills** correctly and gradient
 * **strokes** unreliably - an unresolved stroke falls back to solid black. That
 * was the hard dark outline round the tab bar: a failed gradient stroke, not a
 * border and not a shadow.
 *
 * So the rule here is: gradients are only ever used as fills. Anything that has
 * to be a line is a View with a border or a 1px block. Every visual cue below
 * is chosen to fit that constraint while still reading as a lens.
 *
 * ── The four cues, and why each one is present ───────────────────────────────
 *
 *   1. backdrop blur   - the material samples what is behind it
 *   2. sheen           - a gradient FILL across the top half, brightest at the
 *                        very top, gone by the middle. This is the lens: a
 *                        curved surface gathers light unevenly across its face.
 *   3. rim             - a hairline border. White in both schemes, because a
 *                        lit edge is white; it is only ever dark when the
 *                        render has failed.
 *   4. specular        - a short bright line just inside the top edge, the
 *                        highlight a convex surface throws.
 *
 * ── Why the tint is so low ───────────────────────────────────────────────────
 *
 * `BlurView` with `tint="light"` lays down its own heavy white wash. At high
 * intensity over a light app background that produces a solid white pill with a
 * visible edge - opaque, not glass. Intensity stays low and nothing else fills
 * the shape, so on a pale background the material is nearly invisible and only
 * announces itself when something coloured passes underneath. That is the
 * correct behaviour, not a missing feature.
 */
import React, { ReactNode, useRef, useState } from 'react';
import {
  View, StyleSheet, Platform, ViewStyle, StyleProp, LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect, Pattern, Circle } from 'react-native-svg';
import { useTheme, R } from '../theme';

const androidBlur = Platform.OS === 'android'
  ? ('dimezisBlurView' as const)
  : undefined;

/** SVG ids are document-global in react-native-svg; keep them per-instance. */
let seq = 0;

export function LiquidGlass({
  children, style, radius = R.pill, contentStyle, intensity, weight = 'light',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pass size/2 for a circle, R.pill for a capsule. */
  radius?: number;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Material hierarchy: heavy for toolbars, light for interactive items. */
  weight?: 'light' | 'heavy';
  /** Accepted for call-site compatibility; the rim is no longer a band. */
  edgeWidth?: number;
}) {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  const uid = useRef(`lg${(seq += 1)}`).current;
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // A capsule's true radius is half its height, never the 999 sentinel.
  const r = size.h > 0 ? Math.min(radius, size.h / 2) : radius;

  // Higher intensity for heavy materials to ensure legibility.
  const baseIntensity = weight === 'heavy' ? (dark ? 55 : 50) : (dark ? 34 : 28);
  const blurIntensity = Platform.OS === 'android'
    ? (intensity ?? (baseIntensity + 15))
    : (intensity ?? baseIntensity);

  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      onLayout={onLayout}
    >
      <BlurView
        intensity={blurIntensity}
        tint={dark ? 'dark' : 'light'}
        experimentalBlurMethod={androidBlur}
        style={StyleSheet.absoluteFill}
      />

      {/* Sheen & Grain - gradient and texture to simulate high-end glass. */}
      {size.w > 0 && size.h > 0 ? (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.20 : 0.60} />
              <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={dark ? 0.04 : 0.16} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>

            {/* Subtle physical texture */}
            <Pattern
              id={`${uid}-grain`}
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="2" cy="2" r="0.6" fill={dark ? "#FFFFFF" : "#000000"} fillOpacity="0.02" />
              <Circle cx="25" cy="40" r="0.4" fill={dark ? "#FFFFFF" : "#000000"} fillOpacity="0.015" />
              <Circle cx="48" cy="12" r="0.5" fill={dark ? "#FFFFFF" : "#000000"} fillOpacity="0.02" />
            </Pattern>
          </Defs>

          <Rect
            x={0} y={0} width={size.w} height={size.h}
            rx={r} ry={r}
            fill={`url(#${uid}-grain)`}
          />

          <Rect
            x={0} y={0} width={size.w} height={size.h}
            rx={r} ry={r}
            fill={`url(#${uid}-sheen)`}
          />
        </Svg>
      ) : null}

      {/* 1px Edge Highlight - simulates light catching the rim */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1.2,
            borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.70)',
          },
        ]}
      />

      <View style={contentStyle}>{children}</View>
    </View>
  );
}

/** Circular liquid-glass control. Back buttons, close, icon actions. */
export function GlassCircle({
  size = 44, children, style,
}: { size?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LiquidGlass
      radius={size / 2}
      style={[{ width: size, height: size }, style]}
      contentStyle={{
        width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </LiquidGlass>
  );
}

/**
 * Decorative background with blurred blobs to provide content for
 * glass components to refract.
 */
export function GlassBackground() {
  const { c: P, scheme } = useTheme();
  const dark = scheme === 'dark';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? '#000000' : '#F2F4F7' }]} pointerEvents="none">
      <View style={[st.bubble, st.bubbleTop, { backgroundColor: P.accent, opacity: dark ? 0.12 : 0.08 }]} />
      <View style={[st.bubble, st.bubbleMid, { backgroundColor: '#38BDF8', opacity: dark ? 0.07 : 0.05 }]} />
      <View style={[st.bubble, st.bubbleBottom, { backgroundColor: P.accent, opacity: dark ? 0.10 : 0.06 }]} />
    </View>
  );
}

const st = StyleSheet.create({
  bubble: { position: 'absolute', borderRadius: 999 },
  bubbleTop:    { width: 460, height: 460, top: -210, left: -170 },
  bubbleMid:    { width: 300, height: 300, top: 210,  right: -140 },
  bubbleBottom: { width: 420, height: 420, bottom: -200, right: -130 },
});
