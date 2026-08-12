/** Everything that is not one of the four primary tasks. */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel } from '../components/Primitives';
import { Session } from '../../domain/auth';
import { C, S, R, T, TOUCH } from '../theme';
import { RouteKey } from '../nav/routes';

const ITEMS: { key: RouteKey; title: string; sub: string; phase?: number }[] = [
  { key: 'checkin',   title: 'Daily check-in', sub: 'Track how you are doing over time', phase: 5 },
  { key: 'documents', title: 'Documents',      sub: 'Import a report and read it on-device', phase: 10 },
  { key: 'news',      title: 'Health news',    sub: 'Cached so it reads offline', phase: 11 },
  { key: 'chat',      title: 'Ask a question', sub: 'Needs a connection', phase: 11 },
];

export function MoreScreen({ session, onOpen }:
  { session: Session; onOpen: (r: RouteKey) => void }) {
  const signedIn = session.state === 'SIGNED_IN';
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }}>
      <ScreenHeader title="More" />
      <View style={{ paddingHorizontal: S.xl }}>
        <SectionLabel>ACCOUNT</SectionLabel>
        <Card onPress={() => onOpen('profile')}>
          <Text style={T.bodyStrong}>{signedIn ? session.displayName : 'Not signed in'}</Text>
          <Text style={[T.caption, { marginTop: 3 }]}>
            {signedIn
              ? 'History syncs across your devices'
              : 'Everything works without an account. Sign in only to sync history.'}
          </Text>
        </Card>

        <View style={{ height: S.xxl }} />
        <SectionLabel>MORE TOOLS</SectionLabel>
        {ITEMS.map((i) => (
          <Pressable key={i.key} accessibilityRole="button" accessibilityLabel={i.title}
            onPress={() => onOpen(i.key)}
            style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surfaceAlt }]}>
            <View style={{ flex: 1 }}>
              <Text style={T.bodyStrong}>{i.title}</Text>
              <Text style={[T.caption, { marginTop: 2 }]}>{i.sub}</Text>
            </View>
            {i.phase ? <Text style={st.tag}>PHASE {i.phase}</Text> : null}
            <View style={st.chev} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: TOUCH + 18,
    borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: S.md, paddingHorizontal: S.sm },
  tag: { fontSize: 10.5, fontWeight: '700', color: C.accent, backgroundColor: C.accentSoft,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.sm, overflow: 'hidden' },
  chev: { width: 8, height: 8, borderRightWidth: 2, borderTopWidth: 2,
    borderColor: C.faint, transform: [{ rotate: '45deg' }] },
});
