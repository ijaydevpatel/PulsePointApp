/**
 * Liquid glass material.
 *
 * Not glassmorphism. A glassmorphic panel is uniformly frosted; this is close
 * to clear through the middle and bends what is behind it at the rim, the way
 * a lens does where its surface curves.
 *
 * Five layers, and the order is the whole trick:
 *
 *   1. edge blur    — a heavy BlurView filling the shape
 *   2. edge tint    — a denser fill over it
 *   3. centre       — an inset, separately-rounded view holding a *light* blur
 *                     and a much weaker tint, which cuts a clear window through
 *                     the middle and leaves the heavy blur showing only as a
 *                     band round the rim
 *   4. light        — bright hairline along the top where light enters, a
 *                     second bright edge along the bottom inside face where it
 *                     exits, dim along the sides
 *   5. specular     — a short arc across the top-left
 *
 * Layer 3 is what makes it read as refraction. Real per-pixel distortion needs
 * a GPU shader (react-native-skia would give it), but the eye infers "the
 * content behind is being bent here" from the *gradient* of blur across the
 * surface, not from geometric accuracy. Blurring the rim ~4× harder than the
 * centre produces that gradient with no shader and no extra native module.
 *
 * Layer 4 matters more than it sounds. Light entering the top and leaving the
 * bottom is what gives the material thickness. A single uniform border reads as
 * a stroke round a rectangle; two opposed edges read as a solid object.
 */
import React, { ReactNode, useState } from 'react';
import {
  View, StyleSheet, Platform, ViewStyle, StyleProp, LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { useTheme, R } from '../theme';

const androidBlur = Platform.OS === 'android'
  ? ('dimezisBlurView' as const)
  : undefined;

export function LiquidGlass({
  children, style, radius = R.pill, contentStyle, edgeWidth,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pass size/2 for a circle, R.pill for a capsule. */
  radius?: number;
  contentStyle?: StyleProp<ViewStyle>;
  edgeWidth?: number;
}) {
  const { glass: G } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // A capsule's true corner radius is half its height, never the 999 sentinel.
  const r = size.h > 0 ? Math.min(radius, size.h / 2) : radius;

  // The band must not swallow the whole shape on small controls.
  const ew = Math.min(edgeWidth ?? G.edgeWidth, (Math.min(size.w, size.h) / 2) - 2);
  const innerR = Math.max(0, r - ew);

  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      onLayout={onLayout}
    >
      {/* 1 + 2 — the refracting rim. Heavy blur, denser fill. */}
      <BlurView
        intensity={G.edgeBlur}
        tint={G.tint_mode}
        experimentalBlurMethod={androidBlur}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: G.edgeTint }]} />

      {/* 3 — the clear centre, cutting a window through the heavy blur. */}
      {ew > 0 && size.w > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ew, right: ew, top: ew, bottom: ew,
            borderRadius: innerR,
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={G.centreBlur}
            tint={G.tint_mode}
            experimentalBlurMethod={androidBlur}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: G.centreTint }]} />
        </View>
      ) : null}

      {/* 4 + 5 — the light. */}
      {size.w > 0 && size.h > 0 ? (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            {/*
              Outer rim: brightest at the very top, falling away by a third of
              the height. This is light entering the curve.
            */}
            <LinearGradient id="rimOuter" x1="0" y1="0" x2="0.18" y2="1">
              <Stop offset="0" stopColor={G.rimTop} />
              <Stop offset="0.34" stopColor={G.rimSide} />
              <Stop offset="1" stopColor={G.rimSide} />
            </LinearGradient>

            {/*
              Inner rim: the opposite. Dark at the top, bright along the bottom
              inside face — light leaving the far surface. Having both is what
              gives the material thickness rather than outline.
            */}
            <LinearGradient id="rimInner" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="rgba(0,0,0,0)" />
              <Stop offset="0.55" stopColor="rgba(0,0,0,0)" />
              <Stop offset="1" stopColor={G.rimBottom} />
            </LinearGradient>
          </Defs>

          {/* Outer rim, inset by half its stroke so overflow cannot clip it. */}
          <Rect
            x={0.8} y={0.8}
            width={Math.max(0, size.w - 1.6)}
            height={Math.max(0, size.h - 1.6)}
            rx={Math.max(0, r - 0.8)} ry={Math.max(0, r - 0.8)}
            fill="none"
            stroke="url(#rimOuter)"
            strokeWidth={1.6}
          />

          {/* Inner rim, sitting on the boundary between the two blur zones. */}
          {ew > 1 ? (
            <Rect
              x={ew} y={ew}
              width={Math.max(0, size.w - ew * 2)}
              height={Math.max(0, size.h - ew * 2)}
              rx={innerR} ry={innerR}
              fill="none"
              stroke="url(#rimInner)"
              strokeWidth={1.1}
            />
          ) : null}

          {/*
            Specular arc across the top-left. Short and offset — a highlight
            that spans the full width reads as a stripe, not a reflection.
          */}
          <Path
            d={`M ${Math.max(3, r * 0.5)} ${Math.max(2.4, r * 0.3)}
                Q ${size.w * 0.26} 1.6 ${Math.min(size.w * 0.56, size.w - r * 0.5)} ${Math.max(2.6, r * 0.26)}`}
            stroke={G.specular}
            strokeWidth={1.3}
            strokeLinecap="round"
            fill="none"
            opacity={0.62}
          />
        </Svg>
      ) : null}

      <View style={contentStyle}>{children}</View>
    </View>
  );
}

/**
 * Circular liquid-glass control. Back buttons, close, icon actions.
 *
 * The rim band is scaled down for small controls — a fixed 11pt band on a 36pt
 * circle would leave no clear centre and collapse back into frosted glass.
 */
export function GlassCircle({
  size = 44, children, style,
}: { size?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LiquidGlass
      radius={size / 2}
      edgeWidth={Math.max(4, size * 0.19)}
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
