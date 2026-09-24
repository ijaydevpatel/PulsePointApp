/**
 * The auth visual system.
 *
 * Login and Sign Up are the same screen with different content, and that is
 * enforced here rather than by discipline: both call the same components, so
 * there is no second implementation of the pill button to drift out of sync.
 */
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Pressable, StyleSheet, Text,
  TextInput, TextInputProps, useWindowDimensions, View, ViewStyle, StyleProp,
  AccessibilityInfo, Platform,
} from 'react-native';
import { Icon } from '../components/Icon';
import { BrandMark } from './BrandMark';
import { C, HERO_LEADING, LIFT, T, gaps, heroSize } from './authTheme';
import { useReveal } from '../useReveal';

/* ──────────────────────────────  ENTRANCE  ─────────────────────────────── */

/**
 * Fade and a short rise. 320ms, no spring, no scale — the brief asks for calm,
 * and anything that overshoots reads as playful.
 *
 * Honours reduce-motion: the animation is skipped entirely rather than merely
 * shortened, because a translate is exactly the kind of motion that triggers
 * vestibular symptoms.
 *
 * Driven by useReveal, because this is native-driven and so had the same
 * defect as Enter and TabTransition: the native side never writes the final
 * value back to JavaScript, so a re-render re-applies the initial 0 and the
 * content vanishes. It had not been reported here yet, but these screens
 * carry the text inputs, and opening the keyboard re-renders them.
 */
export function Rise({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { value: v, play, settle } = useReveal();
  const started = useRef(false);

  useEffect(() => {
    // Once per mount. Re-running on a re-render would restart the entrance
    // partway through someone reading it.
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) { settle(); return; }
      play({ duration: 320, delay });
    });
    return () => { cancelled = true; };
  }, [play, settle, delay]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ───────────────────────────────  BRAND  ──────────────────────────────── */

/**
 * The brand lockup: the real mark plus the name.
 *
 * Sized up from the previous 17/17. The name is the app's identity and was
 * reading as a caption — smaller than the supporting copy further down the
 * screen — so it now sits clearly above that, while still well below the hero.
 * The order that matters is hero > wordmark > supporting copy, and only the
 * middle term was wrong.
 *
 * Explicitly transparent. The row had no background of its own, but saying so
 * means no ancestor's surface colour can leak in behind the mark and give it a
 * plate it was never meant to have.
 */
export function Wordmark({ size = 26, large = false }: { size?: number; large?: boolean }) {
  const iconSize = large ? 52 : size;
  return (
    <View
      style={[st.wordmarkRow, large && { gap: 18 }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="PulsePoint"
    >
      <BrandMark size={iconSize} />
      <Text style={[T.wordmark, large && { fontSize: 44 }]}>PulsePoint</Text>
    </View>
  );
}

/* ───────────────────────────────  HERO  ───────────────────────────────── */

/**
 * The editorial headline. Lines are passed in as an array because the breaks
 * are part of the design — letting the text wrap on its own would put the
 * break wherever the device's width happened to fall.
 */
export function Hero({ lines }: { lines: readonly string[] }) {
  const { width, height } = useWindowDimensions();
  const g = gaps(height, width);

  // The longest line decides the size, so none of them soft-wrap and the
  // written breaks are the only breaks.
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  const size = heroSize(width, longest, g.edge);

  return (
    <Text
      style={[
        T.hero,
        {
          fontSize: size,
          lineHeight: Math.round(size * HERO_LEADING),
          /*
           * Android measures a Text block by its line boxes, not by its
           * glyphs, so the last line's descender is cropped by the view
           * bounds however correct the leading is. Playfair's tail drops
           * about 0.21em below the baseline and the line box only accounts
           * for part of that, so the slack has to clear the remainder — 0.1
           * did not, and the 'y' in "ready" was still losing its tail.
           */
          paddingBottom: Math.ceil(size * 0.55),
        },
      ]}
      accessibilityRole="header"
      // One line per entry, enforced. Without this a long line would still
      // wrap on a narrow device and quietly add a row.
      numberOfLines={lines.length}
      // Playfair's ascenders and descenders clip when the system font scale is
      // pushed past ~1.3 at this size, and the break pattern stops making
      // sense. Supporting copy still scales; only the display type is pinned.
      allowFontScaling={false}
    >
      {lines.join('\n')}
    </Text>
  );
}

/* ────────────────────────────  PILL BUTTON  ───────────────────────────── */

/**
 * One button component for every auth control, so the Google pill, the email
 * pill, the submit button and the onboarding CTA cannot end up with different
 * heights or radii.
 *
 * Press feedback is a 0.985 scale and a small opacity drop rather than a
 * ripple: a Material ripple inside a white pill on a white shape is the single
 * most obvious tell that this is a stock Android form.
 */
export function PillButton({
  label, icon, onPress, busy = false, disabled = false, uppercase = false,
  accessibilityHint, widthRatio = 0.88, style,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  uppercase?: boolean;
  accessibilityHint?: string;
  widthRatio?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // Native-driven, so through useReveal — see that file. Left bare, a render
  // landing after a press left the button permanently at 98.5%.
  const press = useReveal(1, 1);
  const scale = press.value;
  const to = (v: number) =>
    press.animateTo(v, { damping: 22, stiffness: 320, mass: 0.6 });

  const locked = busy || disabled;

  return (
    <Animated.View style={[{ transform: [{ scale }], width: `${widthRatio * 100}%` }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !locked && to(0.985)}
        onPressOut={() => to(1)}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, busy }}
        android_disableSound={false}
        style={({ pressed }) => [
          st.pill,
          LIFT,
          disabled && { opacity: 0.45 },
          pressed && !locked && { opacity: 0.92 },
        ]}
      >
        {busy ? (
          /* The loading state stays inside the button — the screen never
             blanks behind a full-page spinner. */
          <ActivityIndicator color={C.ink} size="small" />
        ) : (
          <>
            {icon ? <View style={st.pillIcon}>{icon}</View> : null}
            <Text style={[uppercase ? T.cta : T.button]} numberOfLines={1}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ──────────────────────────  ACCOUNT SWITCHER  ────────────────────────── */

export function AuthSwitcher({
  prompt, action, onPress,
}: { prompt: string; action: string; onPress: () => void }) {
  const { width, height } = useWindowDimensions();
  const g = gaps(height, width);

  return (
    <View style={[st.switcher, { paddingHorizontal: g.edge }]}>
      <Text style={T.prompt}>{prompt}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={action}
        hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
        style={({ pressed }) => [{ marginTop: g.promptToLink }, pressed && { opacity: 0.6 }]}
      >
        <Text style={T.link}>{action}</Text>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────  TEXT FIELD  ───────────────────────────── */

/**
 * White, rounded, minimal. The label sits above the field as a real label
 * rather than as a floating placeholder, so it is still readable once the
 * field has content — and so screen readers get a stable name.
 */
export function AuthField({
  label, value, onChangeText, error, secure, onToggleSecure, secureVisible, ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string | null;
  secure?: boolean;
  onToggleSecure?: () => void;
  secureVisible?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style'>) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={st.fieldWrap}>
      <Text style={[T.label, { marginBottom: 7 }]}>{label}</Text>

      <View style={st.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure && !secureVisible}
          placeholderTextColor={C.ink3}
          accessibilityLabel={label}
          style={[
            st.field,
            T.input,
            { borderColor: error ? C.danger : focused ? C.ink : C.field },
            focused && { borderWidth: 1.6 },
            secure && { paddingRight: 50 },
          ]}
          {...rest}
        />

        {secure && onToggleSecure ? (
          <Pressable
            onPress={onToggleSecure}
            style={st.eye}
            accessibilityRole="button"
            accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Icon name={secureVisible ? 'eye' : 'eyeOff'} size={19} color={C.ink3} />
          </Pressable>
        ) : null}
      </View>

      {error ? <AuthError text={error} compact /> : null}
    </View>
  );
}

/* ───────────────────────────────  ERROR  ──────────────────────────────── */

/**
 * Announced politely rather than assertively: an error that interrupts what
 * the screen reader is already saying loses the field name the person needs.
 */
export function AuthError({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <View
      style={[st.errorRow, compact ? { marginTop: 7 } : { marginTop: 18 }]}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityRole={Platform.OS === 'android' ? 'alert' : undefined}
    >
      <Icon name="alert" size={14} color={C.danger} />
      <Text style={[T.error, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/* ────────────────────────────────  GOOGLE  ────────────────────────────── */

/** The project's existing Google mark, at button scale. */
export function GoogleMark() {
  return <Icon name="google" size={20} />;
}

/** Minimal envelope. Stroked to match the rest of the icon set. */
export function EmailMark() {
  return <Icon name="message" size={19} color={C.ink} />;
}

const st = StyleSheet.create({
  wordmarkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'transparent',
  },

  pill: {
    height: 58,
    borderRadius: 29,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  pillIcon: { marginRight: 12 },

  switcher: { alignItems: 'center' },

  fieldWrap: { width: '100%', marginBottom: 18 },
  fieldRow: { position: 'relative', justifyContent: 'center' },
  field: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1,
    paddingHorizontal: 22,
  },
  eye: { position: 'absolute', right: 20 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
});
