/**
 * Interaction primitives.
 *
 * The single biggest difference between an app that feels cheap and one that
 * feels considered is not colour — it is whether the interface acknowledges a
 * touch before the state changes. Everything pressable here springs under the
 * finger and fires a haptic within a frame, so the app answers immediately even
 * when the work behind it takes longer.
 *
 * Haptics are wrapped in `tap()` rather than called inline, so intensity is
 * decided in one place and can be muted globally for accessibility.
 */
import React, { ReactNode, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, StyleProp, Animated, Easing,
  AccessibilityRole, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReveal } from '../useReveal';
import { useTheme, TYPE, TypeToken, S, R, TOUCH, MOTION, circle } from '../theme';
import { Icon, IconName } from './Icon';
import { LiquidGlass } from './LiquidGlass';

/* ────────────────────────────────  haptics  ─────────────────────────────── */

export type TapWeight = 'light' | 'medium' | 'select' | 'success' | 'warn' | 'error';

/** Fire-and-forget. Never awaited, never allowed to reject into the UI. */
export function tap(weight: TapWeight = 'light') {
  if (Platform.OS === 'web') return;
  const run =
    weight === 'select' ? () => Haptics.selectionAsync()
    : weight === 'success' ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : weight === 'warn' ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : weight === 'error' ? () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    : weight === 'medium' ? () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run().catch(() => {});
}

/* ─────────────────────────────────  text  ───────────────────────────────── */

export function Txt({
  t = 'body', c, style, children, numberOfLines, center,
}: {
  t?: TypeToken; c?: string; style?: StyleProp<TextStyle>;
  children: ReactNode; numberOfLines?: number; center?: boolean;
}) {
  const { c: P } = useTheme();
  const fallback: Record<string, string> = {
    hero: P.ink, display: P.ink, title: P.ink, heading: P.ink,
    section: P.muted, body: P.inkSoft, bodyStrong: P.ink,
    label: P.ink, caption: P.muted, micro: P.faint, numeric: P.ink,
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[TYPE[t], { color: c ?? fallback[t] }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

/* ────────────────────────────────  pressable  ───────────────────────────── */

/**
 * Wraps children in a spring that compresses on press-in and releases on
 * press-out. Uses the native driver, so the animation survives a busy JS
 * thread — which is exactly when a laggy UI would otherwise be noticed.
 */
export function Springy({
  children, onPress, disabled, style, weight = 'light',
  accessibilityRole = 'button', accessibilityLabel, accessibilityState, scaleTo,
}: {
  children: ReactNode; onPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; weight?: TapWeight;
  accessibilityRole?: AccessibilityRole; accessibilityLabel?: string;
  accessibilityState?: object; scaleTo?: number;
}) {
  /*
   * Through useReveal for the same reason as everything else here: the spring
   * is native-driven, so releasing a press returned the scale to 1 on screen
   * while JavaScript still held 0.97. A render landing after that left the
   * control permanently shrunk.
   */
  const press = useReveal(1, 1);
  const scale = press.value;

  const to = (v: number) =>
    press.animateTo(v, {
      damping: MOTION.press.damping,
      stiffness: MOTION.press.stiffness,
      mass: 1,
    });

  // Split layout styles to the root Pressable so flex/margins work as expected.
  const flat = StyleSheet.flatten(style) || {};
  const rootStyle: ViewStyle = {
    flex: flat.flex,
    flexGrow: flat.flexGrow,
    flexShrink: flat.flexShrink,
    flexBasis: flat.flexBasis,
    alignSelf: flat.alignSelf,
    margin: flat.margin,
    marginHorizontal: flat.marginHorizontal,
    marginVertical: flat.marginVertical,
    marginTop: flat.marginTop,
    marginBottom: flat.marginBottom,
    marginLeft: flat.marginLeft,
    marginRight: flat.marginRight,
    position: flat.position,
    top: flat.top,
    bottom: flat.bottom,
    left: flat.left,
    right: flat.right,
    width: flat.width,
    height: flat.height,
    minWidth: flat.minWidth,
    minHeight: flat.minHeight,
  };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      // Instant response on touch-down.
      onPressIn={() => { if (!disabled) { to(scaleTo ?? MOTION.press.scale); tap(weight); } }}
      onPressOut={() => to(1)}
      onPress={onPress}
      style={rootStyle}
    >
      <Animated.View style={[{ transform: [{ scale }], flex: flat.flex ? 1 : undefined }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────────────  entrance  ─────────────────────────────── */

/**
 * Entrance fade-and-rise for content as a screen appears.
 *
 * The reveal is native-driven, which is why it goes through useReveal rather
 * than Animated directly — see that file for the failure this avoids. In
 * short: a native-driven value does not write back to JavaScript, so without
 * it a re-render re-applies the initial 0 and the content disappears.
 */
export function Enter({
  children, index = 0, style,
}: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const { value: v, play } = useReveal();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    play({ duration: MOTION.base, delay: index * MOTION.stagger });
  }, [play, index]);

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

/* ─────────────────────────────────  card  ───────────────────────────────── */

export function Card({
  children, style, onPress, elevated = 1, padded = true, glass = false,
}: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void;
  elevated?: 0 | 1 | 2 | 3; padded?: boolean; glass?: boolean;
}) {
  const { c: P, elev } = useTheme();
  const base: ViewStyle = {
    backgroundColor: glass ? 'transparent' : P.surface,
    borderRadius: R.lg,
    padding: padded ? S.lg : 0,
    borderWidth: glass ? 0 : StyleSheet.hairlineWidth * 2,
    borderColor: P.line,
    ...(glass ? {} : elev(elevated)),
  };

  const content = (
    <View style={[base, style]}>{children}</View>
  );

  if (glass) {
    const wrapped = (
      <LiquidGlass radius={R.lg} style={style} contentStyle={{ padding: padded ? S.lg : 0 }}>
        {children}
      </LiquidGlass>
    );
    if (!onPress) return wrapped;
    return <Springy onPress={onPress} style={style}>{wrapped}</Springy>;
  }

  if (!onPress) return content;
  return <Springy onPress={onPress} style={[base, style]}>{children}</Springy>;
}

/** A card that opens something. Adds the affordance so screens stop repeating it. */
export function NavCard({
  title, subtitle, icon, tint, onPress, right,
}: {
  title: string; subtitle?: string; icon?: IconName; tint?: string;
  onPress: () => void; right?: ReactNode;
}) {
  const { c: P } = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      {icon ? (
        <View style={[st.badge, circle(40), { backgroundColor: (tint ?? P.accent) + '1A' }]}>
          <Icon name={icon} size={20} color={tint ?? P.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt t="bodyStrong">{title}</Txt>
        {subtitle ? <Txt t="caption" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      </View>
      {right ?? <Icon name="chevronRight" size={18} color={P.faint} />}
    </Card>
  );
}

/* ────────────────────────────────  buttons  ─────────────────────────────── */

export function Button({
  title, onPress, tone = 'primary', disabled, busy, icon, full = true,
}: {
  title: string; onPress: () => void;
  tone?: 'primary' | 'quiet' | 'ghost' | 'danger' | 'glass';
  disabled?: boolean; busy?: boolean; icon?: IconName; full?: boolean;
}) {
  const { c: P, elev, scheme } = useTheme();

  const inactive = disabled || busy;

  const bg =
    inactive ? P.sunken
    : tone === 'primary' ? P.accent
    : tone === 'danger' ? P.danger
    : tone === 'quiet' ? P.sunken
    : tone === 'glass' ? 'transparent'
    : 'transparent';

  const fg =
    inactive ? P.faint
    : tone === 'primary' ? P.onAccent
    : tone === 'danger' ? P.onDanger
    : tone === 'glass' ? (scheme === 'dark' ? '#FFFFFF' : P.accent)
    : P.ink;

  const btnContent = (
    <View style={st.btnRow}>
      {icon && !busy ? <Icon name={icon} size={19} color={fg} weight="bold" /> : null}
      <Text style={[TYPE.label, { fontSize: 16, color: fg, letterSpacing: -0.2, fontWeight: '700' }]}>
        {busy ? 'Working…' : title}
      </Text>
    </View>
  );

  const baseStyle: ViewStyle = {
    backgroundColor: bg,
    alignSelf: full ? 'stretch' : 'flex-start',
    minHeight: TOUCH + 8,
    borderRadius: R.pill,
    overflow: 'hidden',
  };

  if (tone === 'glass' && !inactive) {
    return (
      <Springy onPress={onPress} style={baseStyle}>
        <LiquidGlass
          radius={R.pill}
          style={{ flex: 1 }}
          contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl }}
        >
          {btnContent}
        </LiquidGlass>
      </Springy>
    );
  }

  return (
    <Springy
      disabled={inactive}
      onPress={onPress}
      weight={tone === 'danger' ? 'warn' : 'medium'}
      accessibilityLabel={title}
      style={[
        st.btn,
        { backgroundColor: bg, alignSelf: full ? 'stretch' : 'flex-start' },
        (tone === 'primary' || inactive) ? elev(2) : null,
        tone === 'ghost' ? { borderWidth: 1.5, borderColor: inactive ? P.line : P.lineStrong } : null,
      ]}
    >
      {/* 3D Highlight for primary buttons */}
      {!inactive && tone === 'primary' && (
        <View style={[StyleSheet.absoluteFill, {
          borderRadius: R.pill,
          borderTopWidth: 1.5,
          borderTopColor: 'rgba(255,255,255,0.25)',
          borderLeftWidth: 1,
          borderLeftColor: 'rgba(255,255,255,0.1)'
        }]} pointerEvents="none" />
      )}
      {btnContent}
    </Springy>
  );
}

/* ──────────────────────────────  chip / toggle  ─────────────────────────── */

/**
 * Selection chip. The selected state changes fill, border and weight together —
 * three redundant cues — because colour alone fails for the ~8% of men with a
 * colour vision deficiency, which QR6 has to account for.
 */
export function Chip({
  label, selected, onPress, tone,
}: { label: string; selected: boolean; onPress: () => void; tone?: string }) {
  const { c: P } = useTheme();
  const active = tone ?? P.accent;
  return (
    <Springy
      onPress={onPress}
      weight="select"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        st.chip,
        {
          backgroundColor: selected ? active : P.sunken,
          borderColor: selected ? active : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          TYPE.label,
          { color: selected ? P.onAccent : P.inkSoft, fontFamily: selected ? undefined : undefined },
        ]}
      >
        {label}
      </Text>
    </Springy>
  );
}

/** Multi-select row used for the symptom list. Full-width, 44pt, with a tick. */
export function CheckRow({
  label, checked, onPress, danger,
}: { label: string; checked: boolean; onPress: () => void; danger?: boolean }) {
  const { c: P } = useTheme();
  const on = danger ? P.danger : P.accent;
  return (
    <Springy
      onPress={onPress}
      weight="select"
      scaleTo={0.985}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[
        st.row,
        {
          backgroundColor: checked ? on + (P.scheme === 'dark' ? '26' : '14') : P.surface,
          borderColor: checked ? on : P.line,
        },
      ]}
    >
      <View style={[st.box, { borderColor: checked ? on : P.lineStrong, backgroundColor: checked ? on : 'transparent' }]}>
        {checked ? <Icon name="check" size={13} color={P.scheme === 'dark' && !danger ? P.onAccent : '#FFFFFF'} weight="bold" /> : null}
      </View>
      <Text style={[TYPE.body, { flex: 1, color: checked ? P.ink : P.inkSoft }]}>{label}</Text>
    </Springy>
  );
}

/* ────────────────────────────────  misc  ────────────────────────────────── */

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: S.md }, style]}>
      <Txt t="section">{String(children).toUpperCase()}</Txt>
    </View>
  );
}

export function Divider() {
  const { c: P } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: P.line }} />;
}

export function EmptyState({
  title, body, icon = 'records', action,
}: { title: string; body: string; icon?: IconName; action?: ReactNode }) {
  const { c: P } = useTheme();
  return (
    <Enter style={st.empty}>
      <View style={[st.emptyIcon, { backgroundColor: P.sunken }]}>
        <Icon name={icon} size={26} color={P.faint} />
      </View>
      <Txt t="heading" center style={{ marginTop: S.lg }}>{title}</Txt>
      <Txt t="caption" center style={{ marginTop: S.sm, maxWidth: 290 }}>{body}</Txt>
      {action ? <View style={{ marginTop: S.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </Enter>
  );
}

/** Shown when a feature lands in a later phase. Honest rather than a dead button. */
export function PhaseNotice({ phase, what }: { phase: number; what: string }) {
  const { c: P } = useTheme();
  return (
    <View style={[st.phase, { backgroundColor: P.accentSoft, borderLeftColor: P.accent }]}>
      <Txt t="micro" c={P.accent}>{`PHASE ${phase}`}</Txt>
      <Txt t="caption" style={{ marginTop: 3 }}>{what}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  btn: {
    minHeight: TOUCH + 8,
    // Capsule, not a rounded rectangle. Glass has no corners, so neither do
    // the controls that sit alongside it.
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.xl,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  chip: {
    minHeight: TOUCH - 6,
    paddingHorizontal: S.lg,
    borderRadius: R.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: TOUCH + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.lg,
    borderRadius: R.pill,
    borderWidth: 1.5,
  },
  box: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: { alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: S.huge, paddingHorizontal: S.xl },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  phase: { borderRadius: R.md, padding: S.md, borderLeftWidth: 3 },
});
