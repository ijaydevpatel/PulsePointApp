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

export function Rise({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { value: v, play, settle, finished } = useReveal();
  const started = useRef(false);

  useEffect(() => {
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
        finished
          ? null
          : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

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

export function Hero({ lines }: { lines: readonly string[] }) {
  const { width, height } = useWindowDimensions();
  const g = gaps(height, width);

  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  const size = heroSize(width, longest, g.edge);

  return (
    <Text
      style={[
        T.hero,
        {
          fontSize: size,
          lineHeight: Math.round(size * HERO_LEADING),

          paddingBottom: Math.ceil(size * 0.55),
        },
      ]}
      accessibilityRole="header"

      numberOfLines={lines.length}

      allowFontScaling={false}
    >
      {lines.join('\n')}
    </Text>
  );
}

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
  const press = useReveal(1, 1, { native: true });
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

export function GoogleMark() {
  return <Icon name="google" size={20} />;
}

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
