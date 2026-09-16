/** Everything that is not one of the four primary tasks. */
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, NavCard, Txt, Enter, Springy } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { Session } from '../../domain/auth';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Scheme, circle } from '../theme';
import { RouteKey } from '../nav/routes';

const ITEMS: { key: RouteKey; title: string; sub: string; icon: IconName; phase?: number }[] = [
  { key: 'checkin',   title: 'Daily check-in', sub: 'Track how you are doing over time', icon: 'clock', phase: 5 },
  { key: 'documents', title: 'Documents',      sub: 'Import a report and read it on-device', icon: 'records', phase: 10 },
  { key: 'news',      title: 'Health news',    sub: 'Cached so it reads offline', icon: 'search', phase: 11 },
  { key: 'chat',      title: 'Ask a question', sub: 'Needs a connection', icon: 'more', phase: 11 },
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
                    ? 'History syncs across your devices'
                    : 'Everything works without an account. Sign in only to sync.'}
                </Txt>
              </View>
              <Icon name="chevronRight" size={18} color={P.faint} />
            </View>
          </Card>
        </Enter>

        <View style={{ height: S.xxl }} />
        <SectionLabel>More tools</SectionLabel>
        {ITEMS.map((i, n) => (
          <Enter key={i.key} index={n + 2}>
            <View style={{ marginBottom: S.sm }}>
              <NavCard
                title={i.title}
                subtitle={i.sub}
                icon={i.icon}
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
        <SectionLabel>Appearance</SectionLabel>
        <Enter index={6}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={{ flex: 1 }}>
                <Txt t="bodyStrong">Theme</Txt>
                <Txt t="caption" style={{ marginTop: 2 }}>
                  Follows your device unless you pick one
                </Txt>
              </View>
              <View style={[seg.wrap, { backgroundColor: P.sunken }]}>
                {(['light', 'dark'] as Scheme[]).map((k) => {
                  const on = scheme === k;
                  return (
                    <Springy
                      key={k}
                      onPress={() => { if (!on) onToggleScheme(); }}
                      weight="select"
                      scaleTo={0.92}
                      accessibilityLabel={`${k} theme`}
                      accessibilityState={{ selected: on }}
                      style={[seg.item, on && { backgroundColor: P.surface }]}
                    >
                      <Icon
                        name={k === 'light' ? 'sun' : 'moon'}
                        size={18}
                        color={on ? P.accent : P.faint}
                      />
                    </Springy>
                  );
                })}
              </View>
            </View>
          </Card>
        </Enter>
      </View>
    </ScrollView>
  );
}

const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: R.pill, padding: 3, gap: 3 },
  item: { ...circle(TOUCH - 6), alignItems: 'center', justifyContent: 'center' },
});
