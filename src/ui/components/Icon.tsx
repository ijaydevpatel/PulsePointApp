import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

export type IconName =
  | 'home' | 'pulse' | 'pill' | 'pin' | 'records' | 'more'
  | 'chevronRight' | 'chevronLeft' | 'close' | 'check' | 'plus'
  | 'alert' | 'shield' | 'clock' | 'trash' | 'user'
  | 'sun' | 'moon' | 'search' | 'arrowRight'
  | 'message' | 'newspaper' | 'file'
  | 'google' | 'eye' | 'eyeOff';

interface Props {
  name: IconName;
  size?: number;
  color?: string;

  weight?: 'regular' | 'bold';
}

export function Icon({ name, size = 24, color = '#3A46E8', weight = 'regular' }: Props) {
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
    case 'google':
      return (
        <>
          <Path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c1.86-1.71 2.93-4.23 2.93-7.29z"
          />
          <Path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <Path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <Path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </>
      );

    case 'eye':
      return (
        <>
          <Path {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={sw} fill="none" />
        </>
      );

    case 'eyeOff':
      return (
        <>
          <Path {...p} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.45 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Line {...p} x1="1" y1="1" x2="23" y2="23" />
        </>
      );

    case 'pulse':
      return <Path {...p} d="M2 12.5h4.2l2.1-6.6 3.4 12.2 2.6-8.1 1.7 2.5H22" />;

    case 'pill':
      return (
        <>
          <Path {...p} d="M8.8 3.9 3.9 8.8a5.6 5.6 0 0 0 7.9 7.9l4.9-4.9a5.6 5.6 0 0 0-7.9-7.9Z" />
          <Line {...p} x1="7.3" y1="7.3" x2="15.2" y2="15.2" />
          <Path {...p} d="M15.2 3.9a5.6 5.6 0 0 1 4.9 4.9" opacity={0.45} />
        </>
      );

    case 'pin':
      return (
        <>
          <Path {...p} d="M12 21.4c4.1-4.4 6.2-7.8 6.2-10.4a6.2 6.2 0 1 0-12.4 0c0 2.6 2.1 6 6.2 10.4Z" />
          <Line {...p} x1="12" y1="8" x2="12" y2="13.6" />
          <Line {...p} x1="9.2" y1="10.8" x2="14.8" y2="10.8" />
        </>
      );

    case 'message':
      return (
        <>
          <Path {...p} d="M20.4 12.4a7.6 7.6 0 0 1-8.2 7.6L6.4 21l1.1-4.3a7.6 7.6 0 1 1 12.9-4.3Z" />
          <Line {...p} x1="9.2" y1="11.4" x2="15.2" y2="11.4" opacity={0.45} />
          <Line {...p} x1="9.2" y1="14.6" x2="13.2" y2="14.6" opacity={0.45} />
        </>
      );

    case 'newspaper':
      return (
        <>
          <Path {...p} d="M4 5.6h13.2v12.8a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z" />
          <Path {...p} d="M17.2 9.2H20v9.2a2 2 0 0 1-2.8 1.8" opacity={0.45} />
          <Line {...p} x1="7" y1="9.2" x2="14.2" y2="9.2" />
          <Line {...p} x1="7" y1="12.6" x2="14.2" y2="12.6" opacity={0.45} />
          <Line {...p} x1="7" y1="16" x2="11.4" y2="16" opacity={0.45} />
        </>
      );

    case 'file':
      return (
        <>
          <Path {...p} d="M13.4 3.4H7a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
          <Path {...p} d="M13.4 3.4V9H19" opacity={0.45} />
          <Line {...p} x1="8.6" y1="13.4" x2="15.4" y2="13.4" opacity={0.45} />
          <Line {...p} x1="8.6" y1="16.6" x2="12.8" y2="16.6" opacity={0.45} />
        </>
      );

    case 'home':
      return (
        <>
          <Path {...p} d="M3.6 10.4 12 3.6l8.4 6.8v8.2a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8Z" />
          <Path {...p} d="M9.4 20.4v-6.2h5.2v6.2" />
        </>
      );

    case 'records':
      return (
        <>
          <Line {...p} x1="3.2" y1="6.4" x2="20.8" y2="6.4" />
          <Line {...p} x1="3.2" y1="12" x2="16.4" y2="12" />
          <Line {...p} x1="3.2" y1="17.6" x2="12.6" y2="17.6" />
        </>
      );

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

    case 'alert':
      return (
        <>
          <Path {...p} d="M12 3.4 22 20.6H2L12 3.4Z" />
          <Line {...p} x1="12" y1="9.6" x2="12" y2="14.4" />
          <Circle cx="12" cy="17.4" r={sw * 0.55} fill={color} stroke="none" />
        </>
      );

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
