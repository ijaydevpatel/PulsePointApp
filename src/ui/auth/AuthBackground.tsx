/**
 * Backgrounds for the auth flow. Two treatments, deliberately not one.
 *
 *   welcome  — coloured atmosphere in the outer areas, fading to off-white
 *              through the centre, with the white ellipse over it
 *   auth     — off-white and the white ellipse. No colour at all.
 *
 * Login and Sign Up share the second. That difference is the point: the
 * coloured screen is the one you see once, and the screens you actually work
 * on are quiet.
 *
 * ── Why the white shape is drawn, not built from Views ───────────────────────
 *
 * It has to be a true ellipse wider than the screen, so its edge crosses the
 * left and right boundaries rather than curving away inside them. A View with
 * a large borderRadius gives a stadium — straight sides, rounded ends — which
 * is the rounded-rectangle approximation this design is not. An SVG ellipse
 * has continuously varying curvature, and that is what reads as organic.
 *
 * The geometry and the colour fields live in ./atmosphere as plain data, so
 * the rules they have to satisfy can be asserted directly rather than inferred
 * from a rendered tree.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from './authTheme';
import { SHAPE, fieldsFor, tail } from './atmosphere';

export type AuthBackdrop = 'auth' | 'welcome';

export function AuthBackground({
  variant = 'auth',
  width,
  height,
}: {
  variant?: AuthBackdrop;
  width: number;
  height: number;
}) {
  const W = width;
  const H = height;

  const fields = fieldsFor(variant);
  const shape = SHAPE[variant];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.canvas }]} pointerEvents="none">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {fields.length > 0 ? (
          <Defs>
            {fields.map((f) => (
              <RadialGradient key={f.id} id={f.id} cx="50%" cy="50%" r="50%">
                {tail(f.peak).map((s) => (
                  <Stop
                    key={`${f.id}-${s.offset}`}
                    offset={s.offset}
                    stopColor={f.colour}
                    stopOpacity={s.opacity}
                  />
                ))}
              </RadialGradient>
            ))}
          </Defs>
        ) : null}

        <Rect x="0" y="0" width={W} height={H} fill={C.canvas} />

        {fields.map((f) => (
          <Ellipse
            key={f.id}
            cx={W * f.cx}
            cy={H * f.cy}
            rx={W * f.rx}
            ry={H * f.ry}
            fill={`url(#${f.id})`}
          />
        ))}

        {/* Over the atmosphere. No stroke — a border turns it back into a card. */}
        <Ellipse
          cx={W * shape.cx}
          cy={H * shape.cy}
          rx={W * shape.rx}
          ry={H * shape.ry}
          fill={C.surface}
        />
      </Svg>
    </View>
  );
}
