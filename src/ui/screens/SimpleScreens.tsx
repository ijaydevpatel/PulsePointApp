/** Small surfaces that arrive in later phases. Honest placeholders, not dead ends. */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { PhaseNotice, Button, Card, Txt, Enter } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { Session } from '../../domain/auth';
import { useTheme, S, circle } from '../theme';

function Shell({ title, sub, onBack, phase, what, icon }: {
  // Optional: these screens are tab roots now, and a tab root has nothing to
  // go back to. ScreenHeader omits the chevron when onBack is undefined.
  title: string; sub?: string; onBack?: () => void;
  phase: number; what: string; icon: IconName;
}) {
  const { c: P } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.huge }} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={title} subtitle={sub} onBack={onBack} />
      <View style={{ paddingHorizontal: S.xl }}>
        <Enter index={1}>
          <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
            <View style={[circle(78), {
              backgroundColor: P.sunken, alignItems: 'center', justifyContent: 'center',
            }]}>
              <Icon name={icon} size={30} color={P.faint} />
            </View>
          </View>
        </Enter>
        <Enter index={2}>
          <PhaseNotice phase={phase} what={what} />
        </Enter>
      </View>
    </ScrollView>
  );
}

export const CheckInScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Daily check-in" sub="Feeds your trend and streak" onBack={onBack} phase={5} icon="clock"
    what="A short daily entry - how you slept, how you feel, anything new. It drives the trend line and the streak, both stored locally." />
);

export const DocumentsScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Documents" sub="Extracted on-device" onBack={onBack} phase={10} icon="records"
    what="Import a PDF or photo of a report. Text extraction runs on the device, so nothing is uploaded - a privacy improvement over the web version." />
);

export const NewsScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Health news" sub="Cached for offline reading" onBack={onBack} phase={11} icon="search"
    what="A short digest, cached on the device so it stays readable with no connection." />
);

export const ChatScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Ask a question" sub="Needs a connection" onBack={onBack} phase={11} icon="more"
    what="The one feature that genuinely cannot work offline. It is marked as such rather than failing quietly." />
);

export function ProfileScreen({ session, onBack, onSignIn, onSignOut }: {
  session: Session; onBack: () => void; onSignIn: () => void; onSignOut: () => void;
}) {
  const { c: P } = useTheme();
  const signedIn = session.state === 'SIGNED_IN';
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: S.huge }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Account" onBack={onBack} />
        <View style={{ paddingHorizontal: S.xl }}>
          <Enter index={1}>
            <Card elevated={2} glass={true}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={[circle(54), {
                  backgroundColor: signedIn ? P.accent : P.sunken,
                  alignItems: 'center', justifyContent: 'center',
                }]}>
                  <Icon name="user" size={25} color={signedIn ? P.onAccent : P.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt t="heading">{signedIn ? session.displayName : 'Guest'}</Txt>
                  <Txt t="caption" style={{ marginTop: 3 }}>
                    {signedIn ? 'Signed in' : 'Using PulsePoint without an account'}
                  </Txt>
                </View>
              </View>
              <Txt t="body" style={{ marginTop: S.lg }}>
                {signedIn
                  ? 'Your history can sync across devices.'
                  : 'Symptom checks, red-flag alerts and the medicine checker all work exactly the same.'}
              </Txt>
            </Card>
          </Enter>

          <Enter index={2}>
            <View style={{ height: S.xl }} />
            {signedIn
              ? <Button title="Sign out" tone="glass" onPress={onSignOut} />
              : <Button title="Sign in or create an account" tone="glass" icon="user" onPress={onSignIn} />}

            <View style={{ height: S.xxl }} />
            <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
              <Icon name="shield" size={16} color={P.ok} />
              <Txt t="caption" style={{ flex: 1 }}>
                Health data stays on this device, encrypted. Nothing is sent anywhere unless you
                sign in and turn on sync.
              </Txt>
            </View>
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}
