/** Small surfaces that arrive in later phases. Honest placeholders, not dead ends. */
import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { PhaseNotice, Button, Card } from '../components/Primitives';
import { Session } from '../../domain/auth';
import { S, T, C } from '../theme';

function Shell({ title, sub, onBack, phase, what }:
  { title: string; sub?: string; onBack: () => void; phase: number; what: string }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }}>
      <ScreenHeader title={title} subtitle={sub} onBack={onBack} />
      <View style={{ paddingHorizontal: S.xl }}>
        <PhaseNotice phase={phase} what={what} />
      </View>
    </ScrollView>
  );
}

export const CheckInScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Daily check-in" sub="Feeds your trend and streak" onBack={onBack} phase={5}
    what="A short daily entry — how you slept, how you feel, anything new. It drives the trend line and the streak, both stored locally." />
);

export const DocumentsScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Documents" sub="Extracted on-device" onBack={onBack} phase={10}
    what="Import a PDF or photo of a report. Text extraction runs on the device, so nothing is uploaded — a privacy improvement over the web version." />
);

export const NewsScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Health news" sub="Cached for offline reading" onBack={onBack} phase={11}
    what="A short digest, cached on the device so it stays readable with no connection." />
);

export const ChatScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Ask a question" sub="Needs a connection" onBack={onBack} phase={11}
    what="The one feature that genuinely cannot work offline. It is marked as such rather than failing quietly." />
);

export function ProfileScreen({ session, onBack, onSignIn, onSignOut }: {
  session: Session; onBack: () => void; onSignIn: () => void; onSignOut: () => void;
}) {
  const signedIn = session.state === 'SIGNED_IN';
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }}>
      <ScreenHeader title="Account" onBack={onBack} />
      <View style={{ paddingHorizontal: S.xl }}>
        <Card>
          <Text style={T.bodyStrong}>{signedIn ? session.displayName : 'Guest'}</Text>
          <Text style={[T.caption, { marginTop: 4 }]}>
            {signedIn
              ? 'Signed in. Your history can sync across devices.'
              : 'You are using PulsePoint without an account. Symptom checks, red-flag alerts and the medicine checker all work exactly the same.'}
          </Text>
        </Card>
        <View style={{ height: S.xl }} />
        {signedIn
          ? <Button title="Sign out" tone="quiet" onPress={onSignOut} />
          : <Button title="Sign in or create an account" onPress={onSignIn} />}
        <View style={{ height: S.xxl }} />
        <Text style={T.caption}>
          Health data stays on this device, encrypted. Nothing is sent anywhere unless you
          sign in and turn on sync.
        </Text>
      </View>
    </ScrollView>
  );
}
