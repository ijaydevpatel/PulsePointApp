/**
 * Liquid glass material.
 *
 * ── The rendering constraint that shapes this file ───────────────────────────
 *
 * react-native-svg on Android renders gradient **fills** correctly and gradient
 * **strokes** unreliably — an unresolved stroke falls back to solid black. That
 * was the hard dark outline round the tab bar: a failed gradient stroke, not a
 * border and not a shadow.
 *
 * So the rule here is: gradients are only ever used as fills. Anything that has
 * to be a line is a View with a border or a 1px block. Every visual cue below
 * is chosen to fit that constraint while still reading as a lens.
 *
 * ── The four cues, and why each one is present ───────────────────────────────
 *
 *   1. backdrop blur   — the material samples what is behind it
 *   2. sheen           — a gradient FILL across the top half, brightest at the
 *                        very top, gone by the middle. This is the lens: a
 *                        curved surface gathers light unevenly across its face.
 *   3. rim             — a hairline border. White in both schemes, because a
 *                        lit edge is white; it is only ever dark when the
 *                        render has failed.
 *   4. specular        — a short bright line just inside the top edge, the
 *                        highlight a convex surface throws.
 *
 * ── Why the tint is so low ───────────────────────────────────────────────────
 *
 * `BlurView` with `tint="light"` lays down its own heavy white wash. At high
 * intensity over a light app background that produces a solid white pill with a
 * visible edge — opaque, not glass. Intensity stays low and nothing else fills
 * the shape, so on a pale background the material is nearly invisible and only
 * announces itself when something coloured passes underneath. That is the
 * correct behaviour, not a missing feature.
 */
import React, { ReactNode, useRef, useState } from 'react';
import {
  View, StyleSheet, Platform, ViewStyle, StyleProp, LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme, R } from '../theme';

const androidBlur = Platform.OS === 'android'
  ? ('dimezisBlurView' as const)
  : undefined;

/** SVG ids are document-global in react-native-svg; keep them per-instance. */
let seq = 0;

export function LiquidGlass({
  children, style, radius = R.pill, contentStyle, intensity,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pass size/2 for a circle, R.pill for a capsule. */
  radius?: number;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
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

  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      onLayout={onLayout}
    >
      <BlurView
        intensity={intensity ?? (dark ? 30 : 26)}
        tint={dark ? 'dark' : 'light'}
        experimentalBlurMethod={androidBlur}
        style={StyleSheet.absoluteFill}
      />

      {/* Sheen — a gradient FILL, which renders correctly on Android. */}
      {size.w > 0 && size.h > 0 ? (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.16 : 0.55} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={dark ? 0.04 : 0.14} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0} y={0} width={size.w} height={size.h}
            rx={r} ry={r}
            fill={`url(#${uid}-sheen)`}
          />
        </Svg>
      ) : null}

      {/*
        Rim. White in both schemes — a lit edge is white by definition. If this
        ever renders dark, something has failed; it is not a light-mode variant.
      */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.85)',
          },
        ]}
      />

      {/* Specular highlight just inside the top edge. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 1.5,
          left: '20%',
          right: '20%',
          height: StyleSheet.hairlineWidth * 2,
          borderRadius: 1,
          backgroundColor: dark ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,1)',
        }}
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
