/**
 * FR11. Reachable from More → Profile, and never shown as a wall on launch.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Primitives';
import { AuthGateway, Session } from '../../domain/auth';
import { C, S, R, T, TOUCH } from '../theme';

export function AuthScreen({ gateway, onBack, onDone }: {
  gateway: AuthGateway; onBack: () => void; onDone: (s: Session) => void;
}) {
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

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title={mode === 'in' ? 'Sign in' : 'Create account'}
        subtitle="Only needed to sync history across devices"
        onBack={onBack}
      />
      <View style={{ paddingHorizontal: S.xl }}>
        <View style={st.note}>
          <Text style={[T.caption, { color: C.inkSoft }]}>
            You do not need an account. Symptom checks, red-flag alerts and the medicine
            checker all work signed out and offline.
          </Text>
        </View>

        <Text style={[T.label, { marginTop: S.xxl, marginBottom: S.sm }]}>Email</Text>
        <TextInput
          style={st.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          placeholder="you@example.com" placeholderTextColor={C.faint}
          accessibilityLabel="Email address"
        />

        <Text style={[T.label, { marginTop: S.lg, marginBottom: S.sm }]}>Password</Text>
        <TextInput
          style={st.input} value={pw} onChangeText={setPw}
          secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="At least 8 characters" placeholderTextColor={C.faint}
          accessibilityLabel="Password"
        />

        {err ? <Text style={st.err}>{err}</Text> : null}

        <View style={{ height: S.xxl }} />
        <Button title={mode === 'in' ? 'Sign in' : 'Create account'}
          onPress={submit} disabled={!valid} busy={busy} />

        <Pressable onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }}
          accessibilityRole="button" style={st.switch}>
          <Text style={st.switchText}>
            {mode === 'in' ? 'No account? Create one' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>

        <View style={{ height: S.md }} />
        <Button title="Continue without an account" tone="quiet" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  note: { backgroundColor: C.surfaceAlt, borderRadius: R.md, padding: S.lg },
  input: {
    minHeight: TOUCH + 6, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.surface, paddingHorizontal: S.lg, fontSize: 16, color: C.ink,
  },
  err: { marginTop: S.md, fontSize: 13.5, color: C.danger, fontWeight: '600' },
  switch: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: S.md },
  switchText: { fontSize: 14.5, fontWeight: '600', color: C.accent },
});
