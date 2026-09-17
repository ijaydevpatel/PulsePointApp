/**
 * The PulsePoint mark.
 *
 * A transcription of assets/brand/pulsepoint-mark.svg — a hexagon outline with
 * an ECG trace running through it — rather than the generic pulse glyph from
 * the icon set, which was standing in for it.
 *
 * Kept as inline paths instead of loading the .svg at runtime: this is two
 * paths, and importing it would mean adding an SVG transformer to the Metro
 * config for one file. The source SVG stays in assets as the canonical
 * artwork, and the viewBox and path data below are copied from it verbatim so
 * the two cannot drift in shape.
 *
 * Nothing sits behind it. The mark is drawn with `fill="none"` on a
 * transparent canvas, so whatever surface it lands on shows through — there is
 * no plate, no tile, no rounded square.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Hexagon. Near-black rather than pure black, as drawn. */
const HULL = '#1A1A1A';
/** The trace. The one saturated colour in the brand. */
const TRACE = '#D92544';

export function BrandMark({ size = 26 }: { size?: number }) {
  // Stroke widths are in the 24-unit viewBox, so they scale with the mark
  // automatically — no need to recompute them per size.
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      // Decorative here: the wordmark beside it already says "PulsePoint", so
      // announcing the mark separately would read the name twice.
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path
        d="M 12 2 L 20.66 7 L 20.66 17 L 12 22 L 3.34 17 L 3.34 7 Z"
        stroke={HULL}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M 3.34 12 L 8.5 12 L 10.5 6 L 13.5 18 L 15.5 12 L 20.66 12"
        stroke={TRACE}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
