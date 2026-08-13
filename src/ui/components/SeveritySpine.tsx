/**
 * The app's visual signature: four stacked segments, filled up to the band.
 *
 * It appears on the result screen, on every history row and on facility cards,
 * so the same shape always means the same thing. Reading it does not require
 * reading a number, which matters for the cognitive-load attribute (§5.3) and
 * for anyone who cannot distinguish the band colours.
 */
import React from 'react';
import { View } from 'react-native';
import { TriageBand, BAND_ORDER } from '../../domain/entities';
import { useTheme } from '../theme';

export function SeveritySpine({
  band, height = 44, width = 5, horizontal = false, color,
}: {
  band: TriageBand; height?: number; width?: number;
  horizontal?: boolean; color?: string;
}) {
  const { c: P, band: B } = useTheme();
  const level = BAND_ORDER.indexOf(band);
  const on = color ?? B[band].fg;
  const off = color ? color + '38' : P.line;
  const seg = (height - 3 * 2) / 4;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Severity level ${level + 1} of 4: ${B[band].label}`}
      style={[
        horizontal
          ? { flexDirection: 'row', width: height, height: width }
          : { flexDirection: 'column-reverse', width, height },
        { gap: 2 },
      ]}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            minHeight: horizontal ? undefined : seg,
            borderRadius: 3,
            backgroundColor: i <= level ? on : off,
          }}
        />
      ))}
    </View>
  );
}
