/** Small surfaces that arrive in later phases. Honest placeholders, not dead ends. */
import React from 'react';
import { View, Animated } from 'react-native';
import { Session } from '../../domain/auth';
import { useTheme, S, circle } from '../theme';
import { Txt } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { ListSection, ListRow } from '../components/List';
import { IOSButton } from '../components/Controls';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';

function Shell({ title, sub, onBack, phase, what, icon, tint }: {
  title: string; sub?: string; onBack: () => void;
  phase: number; what: string; icon: IconName; tint: string;
}) {
  const { c: P } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();

  return (
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: S.huge }}
      showsVerticalScrollIndicator={false}
    >
      <NavBar title={title} y={nav.y} onBack={onBack} />
      <LargeTitle title={title} subtitle={sub} y={nav.y} />

      <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
        <View style={[circle(76), { backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name={icon} size={34} color="#FFFFFF" weight="bold" />
        </View>
      </View>

      <ListSection header={`Phase ${phase}`} footer={what}>
        <ListRow title="Not built yet" accessory="none" />
      </ListSection>
    </Animated.ScrollView>
  );
}

export const CheckInScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Daily check-in" sub="Feeds your trend and streak" onBack={onBack} phase={5}
    icon="clock" tint="#FF9500"
    what="A short daily entry — how you slept, how you feel, anything new. It drives the trend line and the streak, both stored locally." />
);

export const DocumentsScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Documents" sub="Extracted on-device" onBack={onBack} phase={10}
    icon="records" tint="#5856D6"
    what="Import a PDF or photo of a report. Text extraction runs on the device, so nothing is uploaded — a privacy improvement over the web version." />
);

export const NewsScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Health news" sub="Cached for offline reading" onBack={onBack} phase={11}
    icon="search" tint="#30B0C7"
    what="A short digest, cached on the device so it stays readable with no connection." />
);

export const ChatScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Ask a question" sub="Needs a connection" onBack={onBack} phase={11}
    icon="more" tint="#34C759"
    what="The one feature that genuinely cannot work offline. It is marked as such rather than failing quietly." />
);

export function ProfileScreen({ session, onBack, onSignIn, onSignOut }: {
  session: Session; onBack: () => void; onSignIn: () => void; onSignOut: () => void;
}) {
  const { c: P } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();
  const signedIn = session.state === 'SIGNED_IN';

  return (
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: S.huge }}
      showsVerticalScrollIndicator={false}
    >
      <NavBar title="Account" y={nav.y} onBack={onBack} />
      <LargeTitle title="Account" y={nav.y} />

      <View style={{ alignItems: 'center', paddingBottom: S.xl }}>
        <View style={[circle(88), {
          backgroundColor: signedIn ? P.accent : P.sunken,
          alignItems: 'center', justifyContent: 'center',
        }]}>
          <Icon name="user" size={42} color={signedIn ? P.onAccent : P.faint} />
        </View>
        <Txt t="title2" c={P.ink} style={{ marginTop: S.md }}>
          {signedIn ? session.displayName : 'Guest'}
        </Txt>
        <Txt t="subhead" c={P.muted} style={{ marginTop: 2 }}>
          {signedIn ? 'Signed in' : 'Using PulsePoint without an account'}
        </Txt>
      </View>

      <ListSection
        footer={
          signedIn
            ? 'Your history can sync across devices.'
            : 'Symptom checks, red-flag alerts and the medicine checker all work exactly the same without an account.'
        }
      >
        <ListRow
          title="Health data"
          value="This device only"
          icon="shield"
          iconTint="#34C759"
          accessory="none"
        />
      </ListSection>

      <View style={{ paddingHorizontal: 16 }}>
        {signedIn
          ? <IOSButton title="Sign out" kind="tinted" destructive onPress={onSignOut} />
          : <IOSButton title="Sign in or create an account" icon="user" onPress={onSignIn} />}
      </View>
    </Animated.ScrollView>
  );
}
