/**
 * FR11. Reachable from More → Account, never shown as a wall on launch.
 *
 * The escape hatch is a real button of equal weight, not a greyed link. If
 * someone can be nudged past it by design, the "account gates sync, not access"
 * claim in DESIGN.md is not actually true in the interface.
 */
import React, { useState } from 'react';
import { View, TextInput, Animated, StyleSheet } from 'react-native';
import { AuthGateway, Session } from '../../domain/auth';
import { useTheme, TYPE, S, TOUCH, ROW_INSET } from '../theme';
import { Txt } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ListSection, ListCustomRow } from '../components/List';
import { IOSButton } from '../components/Controls';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';

export function AuthScreen({ gateway, onBack, onDone }: {
  gateway: AuthGateway; onBack: () => void; onDone: (s: Session) => void;
}) {
  const { c: P } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = email.includes('@') && pw.length >= 8;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const s = mode === 'in' ? await gateway.signIn(email, pw) : await gateway.signUp(email, pw);
      onDone(s);
    } catch {
      setErr('That did not work. Check your details and try again.');
    } finally { setBusy(false); }
  }

  const field = { color: P.ink, flex: 1, minHeight: TOUCH - 6, paddingVertical: 0, ...TYPE.body };

  return (
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: S.huge }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <NavBar
        title={mode === 'in' ? 'Sign in' : 'Create account'}
        y={nav.y}
        onBack={onBack}
       
      />
      <LargeTitle
        title={mode === 'in' ? 'Sign in' : 'Create account'}
        subtitle="Only needed to sync history across devices"
        y={nav.y}
      />

      <ListSection footer="You do not need an account. Symptom checks, red-flag alerts and the medicine checker all work signed out and offline.">
        <ListCustomRow>
          <Icon name="shield" size={20} color={P.ok} />
          <Txt t="subhead" c={P.inkSoft} style={{ flex: 1 }}>
            Everything works without signing in
          </Txt>
        </ListCustomRow>
      </ListSection>

      <ListSection header="Details">
        <ListCustomRow>
          <Txt t="body" c={P.muted} style={{ width: 84 }}>Email</Txt>
          <TextInput
            style={field}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={P.faint}
            accessibilityLabel="Email address"
          />
        </ListCustomRow>
        <ListCustomRow>
          <Txt t="body" c={P.muted} style={{ width: 84 }}>Password</Txt>
          <TextInput
            style={field}
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder="At least 8 characters"
            placeholderTextColor={P.faint}
            accessibilityLabel="Password"
          />
        </ListCustomRow>
      </ListSection>

      {err ? (
        <View style={st.err}>
          <Icon name="alert" size={16} color={P.danger} />
          <Txt t="footnote" c={P.danger}>{err}</Txt>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: ROW_INSET, gap: S.md }}>
        <IOSButton
          title={mode === 'in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          disabled={!valid}
          busy={busy}
        />
        <IOSButton
          title={mode === 'in' ? 'No account? Create one' : 'Already have an account? Sign in'}
          kind="plain"
          onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }}
        />
        <IOSButton title="Continue without an account" kind="tinted" onPress={onBack} />
      </View>
    </Animated.ScrollView>
  );
}

const st = StyleSheet.create({
  err: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: ROW_INSET + S.lg, marginBottom: S.lg, marginTop: -S.lg,
  },
});
