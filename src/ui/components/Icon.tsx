/**
 * Icon set.
 *
 * Drawn by hand on a 24×24 grid with a single 1.8 stroke weight, round caps
 * and round joins. Original geometry — not traced from Material, SF Symbols or
 * any other set — so the app carries its own mark rather than looking like a
 * default template.
 *
 * Stroke-only, currentColor-style: every icon takes `color`, so the same glyph
 * serves both schemes and both tab states without duplicate assets.
 */
import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

export type IconName =
  | 'pulse' | 'pill' | 'pin' | 'records' | 'more'
  | 'chevronRight' | 'chevronLeft' | 'close' | 'check' | 'plus'
  | 'alert' | 'shield' | 'clock' | 'trash' | 'user'
  | 'sun' | 'moon' | 'search' | 'arrowRight';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  /** Filled variant for active tab states. Only some icons define one. */
  weight?: 'regular' | 'bold';
}

export function Icon({ name, size = 24, color, weight = 'regular' }: Props) {
  const sw = weight === 'bold' ? 2.4 : 1.8;
  const common = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph(name, common, color, sw)}
    </Svg>
  );
}

function glyph(name: IconName, p: object, color: string, sw: number) {
  switch (name) {
    /* Triage — a cardiac trace that resolves into a steady line. */
    case 'pulse':
      return <Path {...p} d="M2 12.5h4.2l2.1-6.6 3.4 12.2 2.6-8.1 1.7 2.5H22" />;

    /* Medicines — a capsule split on the diagonal. */
    case 'pill':
      return (
        <>
          <Path {...p} d="M8.8 3.9 3.9 8.8a5.6 5.6 0 0 0 7.9 7.9l4.9-4.9a5.6 5.6 0 0 0-7.9-7.9Z" />
          <Line {...p} x1="7.3" y1="7.3" x2="15.2" y2="15.2" />
          <Path {...p} d="M15.2 3.9a5.6 5.6 0 0 1 4.9 4.9" opacity={0.45} />
        </>
      );

    /* Care — a location pin whose head is a cross, not a dot. */
    case 'pin':
      return (
        <>
          <Path {...p} d="M12 21.4c4.1-4.4 6.2-7.8 6.2-10.4a6.2 6.2 0 1 0-12.4 0c0 2.6 2.1 6 6.2 10.4Z" />
          <Line {...p} x1="12" y1="8" x2="12" y2="13.6" />
          <Line {...p} x1="9.2" y1="10.8" x2="14.8" y2="10.8" />
        </>
      );

    /* Records — stacked entries, the top one longer, reading as a timeline. */
    case 'records':
      return (
        <>
          <Line {...p} x1="3.2" y1="6.4" x2="20.8" y2="6.4" />
          <Line {...p} x1="3.2" y1="12" x2="16.4" y2="12" />
          <Line {...p} x1="3.2" y1="17.6" x2="12.6" y2="17.6" />
        </>
      );

    /* More — three dots, weighted so it does not read as an ellipsis. */
    case 'more':
      return (
        <>
          <Circle cx="5" cy="12" r={sw * 0.85} fill={color} stroke="none" />
          <Circle cx="12" cy="12" r={sw * 0.85} fill={color} stroke="none" />
          <Circle cx="19" cy="12" r={sw * 0.85} fill={color} stroke="none" />
        </>
      );

    case 'chevronRight':
      return <Path {...p} d="m9.2 4.8 7.2 7.2-7.2 7.2" />;
    case 'chevronLeft':
      return <Path {...p} d="M14.8 4.8 7.6 12l7.2 7.2" />;
    case 'arrowRight':
      return (
        <>
          <Line {...p} x1="3.6" y1="12" x2="20" y2="12" />
          <Path {...p} d="m13.8 5.8 6.2 6.2-6.2 6.2" />
        </>
      );
    case 'close':
      return (
        <>
          <Line {...p} x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          <Line {...p} x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
        </>
      );
    case 'check':
      return <Path {...p} d="m4.6 12.6 4.8 4.8L19.4 7.2" />;
    case 'plus':
      return (
        <>
          <Line {...p} x1="12" y1="4.8" x2="12" y2="19.2" />
          <Line {...p} x1="4.8" y1="12" x2="19.2" y2="12" />
        </>
      );

    /* Alert — triangle with a stem. Used only for red flags. */
    case 'alert':
      return (
        <>
          <Path {...p} d="M12 3.4 22 20.6H2L12 3.4Z" />
          <Line {...p} x1="12" y1="9.6" x2="12" y2="14.4" />
          <Circle cx="12" cy="17.4" r={sw * 0.55} fill={color} stroke="none" />
        </>
      );

    /* Shield — used for the encrypted-storage and privacy affordances. */
    case 'shield':
      return (
        <>
          <Path {...p} d="M12 2.8 20 6v6c0 4.4-3.2 7.6-8 9.2-4.8-1.6-8-4.8-8-9.2V6l8-3.2Z" />
          <Path {...p} d="m8.6 11.8 2.4 2.4 4.4-4.4" />
        </>
      );

    case 'clock':
      return (
        <>
          <Circle {...p} cx="12" cy="12" r="9" />
          <Path {...p} d="M12 6.8V12l3.4 2" />
        </>
      );

    case 'trash':
      return (
        <>
          <Line {...p} x1="3.6" y1="6.4" x2="20.4" y2="6.4" />
          <Path {...p} d="M8.6 6.4V4.6a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6v1.8" />
          <Path {...p} d="M5.8 6.4 7 19.4A1.8 1.8 0 0 0 8.8 21h6.4a1.8 1.8 0 0 0 1.8-1.6l1.2-13" />
        </>
      );

    case 'user':
      return (
        <>
          <Circle {...p} cx="12" cy="8.2" r="3.9" />
          <Path {...p} d="M4.4 20.6a7.6 7.6 0 0 1 15.2 0" />
        </>
      );

    case 'sun':
      return (
        <>
          <Circle {...p} cx="12" cy="12" r="4.2" />
          <Line {...p} x1="12" y1="2.4" x2="12" y2="4.6" />
          <Line {...p} x1="12" y1="19.4" x2="12" y2="21.6" />
          <Line {...p} x1="2.4" y1="12" x2="4.6" y2="12" />
          <Line {...p} x1="19.4" y1="12" x2="21.6" y2="12" />
          <Line {...p} x1="5.2" y1="5.2" x2="6.8" y2="6.8" />
          <Line {...p} x1="17.2" y1="17.2" x2="18.8" y2="18.8" />
          <Line {...p} x1="18.8" y1="5.2" x2="17.2" y2="6.8" />
          <Line {...p} x1="6.8" y1="17.2" x2="5.2" y2="18.8" />
        </>
      );

    case 'moon':
      return <Path {...p} d="M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11Z" />;

    case 'search':
      return (
        <>
          <Circle {...p} cx="10.8" cy="10.8" r="7" />
          <Line {...p} x1="15.9" y1="15.9" x2="21" y2="21" />
        </>
      );
  }
}
