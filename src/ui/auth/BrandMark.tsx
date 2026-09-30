import React from 'react';
import Svg, { Path } from 'react-native-svg';

const HULL = '#1A1A1A';

const TRACE = '#D92544';

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"

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
