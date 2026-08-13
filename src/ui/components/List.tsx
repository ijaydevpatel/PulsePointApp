/**
 * Grouped inset lists — the single most recognisable iOS layout.
 *
 * The rules that make it read correctly, none of which are decoration:
 *
 *   • Cards sit inset on a grey grouped background, not flush to the edge.
 *   • Separators start at the *content* edge, not the card edge, so they line
 *     up under the first character of the label rather than under the icon.
 *   • The last row has no separator. A trailing line inside a rounded card is
 *     the single most common tell of an imitation.
 *   • Corners are rounded on the section, not on each row, so the rows read as
 *     one continuous card.
 *   • The whole row is the touch target, and it flashes a fill on press rather
 *     than scaling — iOS list rows do not spring.
 *   • Section headers are uppercase footnote in secondary ink; footers are
 *     sentence case and explanatory.
 */
import React, { Children, ReactNode, isValidElement } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme, TYPE, S, R, ROW, ROW_INSET, TOUCH, concentric } from '../theme';
import { Icon, IconName } from './Icon';
import { Txt, tap } from './Primitives';

/* ─────────────────────────────────  section  ────────────────────────────── */

export function ListSection({
  header, footer, children, style,
}: {
  header?: string; footer?: string; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { c: P } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[{ marginBottom: S.xxl }, style]}>
      {header ? (
        <Txt t="footnote" c={P.muted} style={st.header}>
          {header.toUpperCase()}
        </Txt>
      ) : null}

      {/*
        One large radius rather than the tight 10pt of iOS 18. In 26 the card
        radius echoes the display corner, which is what makes a list read as
        part of the device rather than a box drawn on it.
      */}
      <View style={[st.card, { backgroundColor: P.surface, borderRadius: R.lg }]}>
        {rows.map((row, i) => (
          <View key={i}>
            {row}
            {i < rows.length - 1 ? (
              // Inset from the content edge, never the card edge.
              <View style={[st.sep, { backgroundColor: P.line, marginLeft: ROW_INSET }]} />
            ) : null}
          </View>
        ))}
      </View>

      {footer ? (
        <Txt t="footnote" c={P.muted} style={st.footer}>{footer}</Txt>
      ) : null}
    </View>
  );
}

/* ───────────────────────────────────  row  ──────────────────────────────── */

export function ListRow({
  title, subtitle, icon, iconTint, value, onPress, accessory = 'chevron',
  destructive, trailing, leading,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Fill behind the icon. iOS uses a saturated tile per row. */
  iconTint?: string;
  /** Secondary text on the right, as in Settings. */
  value?: string;
  onPress?: () => void;
  accessory?: 'chevron' | 'none' | 'check';
  destructive?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
}) {
  const { c: P } = useTheme();
  const ink = destructive ? P.danger : P.ink;

  const content = (pressed: boolean) => (
    <View style={[
      st.row,
      { backgroundColor: pressed ? P.sunken : 'transparent' },
    ]}>
      {leading}

      {icon ? (
        <View style={[st.tile, { backgroundColor: iconTint ?? P.accent }]}>
          <Icon name={icon} size={17} color="#FFFFFF" weight="bold" />
        </View>
      ) : null}

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Txt t="body" c={ink} numberOfLines={1}>{title}</Txt>
        {subtitle ? (
          <Txt t="footnote" c={P.muted} style={{ marginTop: 1 }}>{subtitle}</Txt>
        ) : null}
      </View>

      {value ? <Txt t="body" c={P.muted} numberOfLines={1}>{value}</Txt> : null}
      {trailing}

      {accessory === 'chevron' && onPress ? (
        <Icon name="chevronRight" size={16} color={P.faint} />
      ) : null}
      {accessory === 'check' ? (
        <Icon name="check" size={18} color={P.accent} weight="bold" />
      ) : null}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onPressIn={() => tap('light')}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

/** A row whose content is arbitrary, keeping the section's insets and press. */
export function ListCustomRow({
  children, onPress, minHeight = ROW + 10,
}: { children: ReactNode; onPress?: () => void; minHeight?: number }) {
  const { c: P } = useTheme();
  const inner = (pressed: boolean) => (
    <View style={[
      st.row,
      { minHeight, backgroundColor: pressed ? P.sunken : 'transparent' },
    ]}>
      {children}
    </View>
  );
  if (!onPress) return inner(false);
  return (
    <Pressable onPress={onPress} onPressIn={() => tap('light')} accessibilityRole="button">
      {({ pressed }) => inner(pressed)}
    </Pressable>
  );
}

const st = StyleSheet.create({
  header: {
    marginLeft: ROW_INSET + S.md,
    marginRight: S.xl,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  footer: {
    marginLeft: ROW_INSET + S.md,
    marginRight: S.xl,
    marginTop: 8,
  },
  card: {
    marginHorizontal: ROW_INSET,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: ROW,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 11,
  },
  sep: { height: StyleSheet.hairlineWidth * 2 },
  tile: {
    width: 32, height: 32,
    // Nested inside a R.lg card at ROW_INSET padding — kept parallel.
    borderRadius: concentric(R.lg, 12),
    alignItems: 'center', justifyContent: 'center',
  },
});
