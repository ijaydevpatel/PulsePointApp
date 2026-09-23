/**
 * The account sheet, opened by the avatar.
 *
 * Holds the three destinations that are not in the tab bar — Records, Chat,
 * News — plus settings and sign-out. They are here rather than in a "More"
 * bucket on the bar because of what they are: reference material and account
 * controls, not the things someone opens the app to do.
 *
 * ── On sign-out ──────────────────────────────────────────────────────────────
 *
 * Signing out asks first, and says what it costs. Triage, red flags and the
 * medicine check keep working signed out, but sync stops and anything the
 * phone has not sent stays only on the phone — that is worth one tap to
 * confirm, and it is stated rather than implied.
 *
 * The destructive action sits apart from the navigation rows and is the only
 * thing on the sheet drawn in the danger colour, so it cannot be hit while
 * aiming for Settings.
 */
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Session } from '../../domain/auth';
import { RouteKey } from '../nav/routes';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Txt, Button, Enter } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE } from '../theme';

interface Row {
  key: RouteKey;
  icon: IconName;
  label: string;
  hint: string;
}

/**
 * Ordered by how often they are wanted, not alphabetically. Records first: it
 * is the one thing here that only exists on the phone, and the one people come
 * looking for.
 */
const ROWS: readonly Row[] = [
  { key: 'records', icon: 'records',   label: 'Records',  hint: 'Past assessments held on this device' },
  { key: 'chat',    icon: 'message',   label: 'Chat',     hint: 'Ask about a symptom or a medicine' },
  { key: 'news',    icon: 'newspaper', label: 'Health news', hint: 'Recent articles' },
  { key: 'settings', icon: 'shield',   label: 'Settings', hint: 'Appearance, data and about' },
];

export function ProfileSheet({
  session, onBack, onOpen, onSignOut,
}: {
  session: Session;
  onBack: () => void;
  onOpen: (r: RouteKey) => void;
  onSignOut: () => Promise<void>;
}) {
  const { c: P } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = session.displayName?.trim() || 'Your account';
  const initial = name[0]?.toUpperCase() ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Account" onBack={onBack} large={false} />

      <ScrollView
        contentContainerStyle={st.body}
        showsVerticalScrollIndicator={false}
      >
        <Enter index={1}>
          <Card style={st.identity}>
            <View style={[st.avatar, { backgroundColor: P.ink }]}>
              {initial
                ? <Txt t="title" c={P.bg}>{initial}</Txt>
                : <Icon name="user" size={22} color={P.bg} />}
            </View>
            <View style={{ flex: 1 }}>
              <Txt t="bodyStrong" numberOfLines={1}>{name}</Txt>
              <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
                {session.state === 'SIGNED_IN' ? 'Signed in — history syncs' : 'Signed out — local only'}
              </Txt>
            </View>
          </Card>
        </Enter>

        <Enter index={2}>
          <View style={{ height: S.xl }} />
          <Card padded={false}>
            {ROWS.map((r, i) => (
              <Pressable
                key={r.key}
                onPress={() => onOpen(r.key)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                accessibilityHint={r.hint}
                style={({ pressed }) => [
                  st.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line },
                  pressed && { backgroundColor: P.sunken },
                ]}
              >
                <View style={[st.rowIcon, { backgroundColor: P.sunken }]}>
                  <Icon name={r.icon} size={18} color={P.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt t="bodyStrong">{r.label}</Txt>
                  <Txt t="caption" c={P.muted} style={{ marginTop: 1 }}>{r.hint}</Txt>
                </View>
                <Icon name="chevronRight" size={18} color={P.muted} />
              </Pressable>
            ))}
          </Card>
        </Enter>

        <Enter index={3}>
          <View style={{ height: S.xxl }} />
          {confirming ? (
            <Card style={{ padding: S.lg }}>
              <Txt t="bodyStrong">Sign out of PulsePoint?</Txt>
              <Txt t="caption" c={P.muted} style={{ marginTop: 6 }}>
                Symptom checks, red flags and the medicine check keep working.
                History stops syncing, and anything not yet sent stays on this
                phone only.
              </Txt>
              <View style={st.confirmRow}>
                <Pressable
                  onPress={() => setConfirming(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [st.ghost, pressed && { opacity: 0.6 }]}
                >
                  <Txt t="label">Cancel</Txt>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setBusy(true);
                    try { await onSignOut(); } finally { setBusy(false); }
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ busy }}
                  style={({ pressed }) => [
                    st.danger,
                    { backgroundColor: P.danger },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Txt t="label" c={P.onDanger}>{busy ? 'Signing out…' : 'Sign out'}</Txt>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Pressable
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [st.signOut, pressed && { opacity: 0.6 }]}
            >
              <Txt t="label" c={P.danger}>Sign out</Txt>
            </Pressable>
          )}
        </Enter>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE },

  identity: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH + 12, paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  signOut: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  ghost: {
    flex: 1, minHeight: TOUCH, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  danger: {
    flex: 1, minHeight: TOUCH, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
