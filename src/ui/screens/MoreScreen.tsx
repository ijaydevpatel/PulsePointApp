import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, NavCard, Txt, Enter, Springy } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { Session } from '../../domain/auth';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Scheme, circle } from '../theme';
import { RouteKey } from '../nav/routes';

const ITEMS: { key: RouteKey; title: string; sub: string; icon: IconName; phase?: number; tint?: string }[] = [
  { key: 'chat',      title: 'Talk to a Doctor', sub: 'Consult with our AI medical assistant', icon: 'message', tint: '#3A46E8' },
  { key: 'news',      title: 'Health News',    sub: 'Stay updated with latest health insights', icon: 'newspaper', tint: '#FF9A52' },
  { key: 'checkin',   title: 'Daily Check-in', sub: 'Track your mood and recovery trend', icon: 'clock', tint: '#8F97FF' },
];

export function MoreScreen({ session, onOpen, scheme, onToggleScheme }: {
  session: Session;
  onOpen: (r: RouteKey) => void;
  scheme: Scheme;
  onToggleScheme: () => void;
}) {
  const { c: P } = useTheme();
  const signedIn = session.state === 'SIGNED_IN';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="More" />
        <View style={{ paddingHorizontal: S.xl }}>
          <Enter index={1}>
            <SectionLabel>Account</SectionLabel>
            <Card onPress={() => onOpen('profile')} elevated={2}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={[circle(48), {
                  backgroundColor: signedIn ? P.accent : P.sunken,
                  alignItems: 'center', justifyContent: 'center',
                }]}>
                  <Icon name="user" size={22} color={signedIn ? P.onAccent : P.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt t="heading">{signedIn ? session.displayName : 'Not signed in'}</Txt>
                  <Txt t="caption" style={{ marginTop: 3 }}>
                    {signedIn
                      ? 'Your health profile is saved to your account'
                      : 'Everything works without an account. Sign in only to sync.'}
                  </Txt>
                </View>
                <Icon name="chevronRight" size={18} color={P.faint} />
              </View>
            </Card>
          </Enter>

          <View style={{ height: S.xxl }} />
        <SectionLabel>Tools & Health</SectionLabel>
        {ITEMS.map((i, n) => (
          <Enter key={i.key} index={n + 2}>
            <View style={{ marginBottom: S.sm }}>
              <NavCard
                title={i.title}
                subtitle={i.sub}
                icon={i.icon}
                tint={i.tint}
                onPress={() => onOpen(i.key)}
                right={
                  i.phase ? (
                    <View style={{
                      paddingHorizontal: 10, paddingVertical: 4,
                      borderRadius: R.pill, backgroundColor: P.accentSoft,
                    }}>
                      <Txt t="micro" c={P.accent}>{`PHASE ${i.phase}`}</Txt>
                    </View>
                  ) : undefined
                }
              />
            </View>
          </Enter>
        ))}

          <View style={{ height: S.xxl }} />
          <SectionLabel>App</SectionLabel>
          <Enter index={6}>
            <View style={{ marginBottom: S.sm }}>
              <NavCard
                title="Settings"
                subtitle="Appearance, your data, disclaimer and legal"
                icon="shield"
                onPress={() => onOpen('settings')}
              />
            </View>
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: R.pill, padding: 3, gap: 3 },
  item: { ...circle(TOUCH - 6), alignItems: 'center', justifyContent: 'center' },
});
