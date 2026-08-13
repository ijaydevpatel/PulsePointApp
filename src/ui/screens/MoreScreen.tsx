/**
 * Everything that is not one of the four primary tasks.
 *
 * Straight iOS Settings: an account row with an avatar at the top, then
 * grouped sections. The coloured icon tiles are the convention that makes a
 * settings list scannable — you find the row by colour before you read it.
 */
import React from 'react';
import { View, Animated } from 'react-native';
import { Session } from '../../domain/auth';
import { useTheme, S, TAB_CLEARANCE, circle, Scheme } from '../theme';
import { RouteKey } from '../nav/routes';
import { Icon, IconName } from '../components/Icon';
import { Txt } from '../components/Primitives';
import { ListSection, ListRow, ListCustomRow } from '../components/List';
import { Segmented } from '../components/Controls';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';

const TOOLS: { key: RouteKey; title: string; sub: string; icon: IconName; tint: string; phase: number }[] = [
  { key: 'checkin',   title: 'Daily check-in', sub: 'Track how you are doing over time',   icon: 'clock',   tint: '#FF9500', phase: 5 },
  { key: 'documents', title: 'Documents',      sub: 'Import a report, read it on-device',  icon: 'records', tint: '#5856D6', phase: 10 },
  { key: 'news',      title: 'Health news',    sub: 'Cached so it reads offline',          icon: 'search',  tint: '#30B0C7', phase: 11 },
  { key: 'chat',      title: 'Ask a question', sub: 'Needs a connection',                  icon: 'more',    tint: '#34C759', phase: 11 },
];

export function MoreScreen({ session, onOpen, scheme, onToggleScheme }: {
  session: Session;
  onOpen: (r: RouteKey) => void;
  scheme: Scheme;
  onToggleScheme: () => void;
}) {
  const { c: P } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();
  const signedIn = session.state === 'SIGNED_IN';

  return (
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: TAB_CLEARANCE + S.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <NavBar title="More" y={nav.y} />
      <LargeTitle title="More" y={nav.y} />

      <ListSection>
        <ListCustomRow onPress={() => onOpen('profile')} minHeight={72}>
          <View style={[circle(58), {
            backgroundColor: signedIn ? P.accent : P.sunken,
            alignItems: 'center', justifyContent: 'center',
          }]}>
            <Icon name="user" size={28} color={signedIn ? P.onAccent : P.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt t="title3" c={P.ink}>{signedIn ? session.displayName : 'Not signed in'}</Txt>
            <Txt t="footnote" c={P.muted} style={{ marginTop: 2 }}>
              {signedIn
                ? 'History syncs across your devices'
                : 'Everything works without an account'}
            </Txt>
          </View>
          <Icon name="chevronRight" size={16} color={P.faint} />
        </ListCustomRow>
      </ListSection>

      <ListSection
        header="More tools"
        footer="Each of these arrives in a later build phase. They are listed rather than hidden so the plan is visible."
      >
        {TOOLS.map((t) => (
          <ListRow
            key={t.key}
            title={t.title}
            subtitle={t.sub}
            icon={t.icon}
            iconTint={t.tint}
            value={`Phase ${t.phase}`}
            onPress={() => onOpen(t.key)}
          />
        ))}
      </ListSection>

      <ListSection header="Appearance" footer="Follows your device unless you pick one.">
        <ListCustomRow>
          <View style={{ flex: 1 }}>
            <Txt t="body" c={P.ink}>Theme</Txt>
          </View>
          <Segmented
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] as const}
            value={scheme}
            onChange={(v) => { if (v !== scheme) onToggleScheme(); }}
            style={{ width: 150 }}
          />
        </ListCustomRow>
      </ListSection>

      <ListSection header="Privacy">
        <ListRow
          title="Where your data lives"
          subtitle="On this device, encrypted"
          icon="shield"
          iconTint="#34C759"
          accessory="none"
        />
      </ListSection>
    </Animated.ScrollView>
  );
}
