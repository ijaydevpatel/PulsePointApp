/**
 * iOS control set: segmented control, switch, filled button.
 *
 * The segmented control is the fiddly one. What makes it read correctly is the
 * *thumb* — a white capsule that slides between segments over a grey track,
 * rather than the selected label simply changing colour. It also has a hairline
 * divider between unselected segments that disappears next to the thumb, which
 * is a detail people notice without being able to name.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Pressable, StyleSheet, Animated, LayoutChangeEvent, ViewStyle, StyleProp,
} from 'react-native';
import { useTheme, TYPE, S, R, MOTION, TOUCH } from '../theme';
import { LiquidGlass } from './LiquidGlass';
import { Txt, tap } from './Primitives';
import { Icon, IconName } from './Icon';

/* ───────────────────────────  segmented control  ────────────────────────── */

export function Segmented<T extends string | number>({
  options, value, onChange, style, compact,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Drops to 13pt with tighter padding. Needed at five segments, where 15pt
   * labels truncate — iOS does the same rather than let a segment ellipsise,
   * because a control you cannot read the options of is worse than a small one.
   */
  compact?: boolean;
}) {
  const { c: P, scheme } = useTheme();
  const [w, setW] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(x, {
      toValue: index,
      damping: 22,
      stiffness: 300,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [index, x]);

  const seg = w / Math.max(1, options.length);

  return (
    <View
      style={[st.track, { backgroundColor: scheme === 'dark' ? '#1C1C1E' : '#E9E9EB' }, style]}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 4)}
      accessibilityRole="tablist"
    >
      {w > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            st.thumb,
            {
              width: seg,
              backgroundColor: scheme === 'dark' ? '#636366' : '#FFFFFF',
              transform: [{
                translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }),
              }],
            },
          ]}
        />
      ) : null}

      {options.map((o, i) => {
        const on = o.value === value;
        // The divider next to the thumb is suppressed, as on iOS.
        const showDivider = i > 0 && i !== index && i - 1 !== index;
        return (
          <React.Fragment key={String(o.value)}>
            {showDivider ? (
              <View style={[st.divider, { backgroundColor: P.line }]} />
            ) : (
              <View style={st.dividerSpacer} />
            )}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              onPress={() => { if (!on) { tap('select'); onChange(o.value); } }}
              style={st.segment}
            >
              <Txt
                t={compact ? 'footnote' : 'subhead'}
                c={on ? P.ink : P.inkSoft}
                numberOfLines={1}
                style={on ? {
                  fontFamily: TYPE.headline.fontFamily,
                  fontSize: compact ? 13 : 15,
                } : undefined}
              >
                {o.label}
              </Txt>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ────────────────────────────────  switch  ──────────────────────────────── */

export function Toggle({
  value, onChange, accessibilityLabel,
}: { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string }) {
  const { c: P, scheme } = useTheme();
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(a, {
      toValue: value ? 1 : 0,
      damping: 20, stiffness: 320, mass: 0.7,
      useNativeDriver: false,
    }).start();
  }, [value, a]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => { tap('select'); onChange(!value); }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          st.switchTrack,
          {
            backgroundColor: a.interpolate({
              inputRange: [0, 1],
              outputRange: [scheme === 'dark' ? '#39393D' : '#E9E9EA', '#34C759'],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            st.knob,
            { transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ────────────────────────────────  button  ──────────────────────────────── */

/**
 * iOS buttons dim on press rather than springing. Scaling a full-width filled
 * button is an Android/Material gesture and is one of the fastest ways to break
 * the illusion.
 */
export function IOSButton({
  title, onPress, kind = 'filled', disabled, busy, icon, destructive,
}: {
  title: string; onPress: () => void;
  /**
   * `glass` is the iOS 26 default for chrome sitting over content — a clear
   * capsule with a lit rim rather than a flat fill. `filled` is retained for
   * the one call to action per screen, which 26 still renders solid so it
   * cannot be mistaken for chrome.
   */
  kind?: 'filled' | 'tinted' | 'plain' | 'glass';
  disabled?: boolean; busy?: boolean; icon?: IconName; destructive?: boolean;
}) {
  const { c: P } = useTheme();
  const inactive = disabled || busy;
  const base = destructive ? P.danger : P.accent;

  const bg =
    inactive ? P.sunken
    : kind === 'glass' ? 'transparent'
    : kind === 'filled' ? base
    : kind === 'tinted' ? (destructive ? P.dangerSoft : P.accentSoft)
    : 'transparent';

  const fg =
    inactive ? P.muted
    : kind === 'filled' ? (destructive ? P.onDanger : P.onAccent)
    : base;

  const label = (
    <>
      {icon && !busy ? <Icon name={icon} size={18} color={fg} weight="bold" /> : null}
      <Txt t="headline" c={fg}>{busy ? 'Working…' : title}</Txt>
    </>
  );

  if (kind === 'glass' && !inactive) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => tap('medium')}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        <LiquidGlass radius={R.pill} edgeWidth={9} contentStyle={st.glassInner}>
          {label}
        </LiquidGlass>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => tap('medium')}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive }}
      style={({ pressed }) => [
        st.button,
        { backgroundColor: bg, opacity: pressed ? 0.55 : 1 },
      ]}
    >
      {label}
    </Pressable>
  );
}

const st = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.pill,
    padding: 2.5,
    minHeight: 36,
  },
  thumb: {
    position: 'absolute',
    top: 2.5, bottom: 2.5, left: 2.5,
    borderRadius: R.pill,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 31, paddingHorizontal: 2 },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 16, alignSelf: 'center' },
  dividerSpacer: { width: StyleSheet.hairlineWidth * 2 },

  switchTrack: { width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: 'center' },
  knob: {
    width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    // Capsule. iOS 26 buttons are fully rounded, not 14pt rectangles.
    minHeight: TOUCH + 6, borderRadius: R.pill, paddingHorizontal: S.xl,
  },
  glassInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    minHeight: TOUCH + 6, paddingHorizontal: S.xl,
  },
});
