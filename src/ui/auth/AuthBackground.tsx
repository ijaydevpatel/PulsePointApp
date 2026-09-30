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
