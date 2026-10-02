import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, NavCard, SectionLabel, Txt, Springy, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Scheme } from '../theme';
import { Session } from '../../domain/auth';
import { EpisodeStore } from '../../domain/ports';
import { ActivityLog } from '../../domain/activity';
import { RouteKey } from '../nav/routes';

const PRIVACY_URL = 'https://pulsepoint-ekqb.onrender.com/privacy';
const TERMS_URL = 'https://pulsepoint-ekqb.onrender.com/terms';

export function SettingsScreen({
  session, store, scheme, onToggleScheme, onBack, onOpen, onSignOut, historyKey,
  onDataCleared,
}: {
  session: Session;
  store: EpisodeStore & ActivityLog;
  scheme: Scheme;
  onToggleScheme: () => void;
  onBack: () => void;
  onOpen: (r: RouteKey) => void;
  onSignOut: () => void | Promise<void>;

  historyKey?: number;

  onDataCleared?: () => void;
}) {
  const { c: P } = useTheme();
  const [records, setRecords] = useState<number | null>(null);

  const count = useCallback(async () => {
    try {
      const all = await store.history(500);
      setRecords(all.length);
    } catch {
      setRecords(null);
    }
  }, [store]);

  useEffect(() => { void count(); }, [count, historyKey]);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>Account</SectionLabel>
        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title={session.displayName ?? (session.nameResolved ? 'Your profile' : '')}
            subtitle={session.state === 'SIGNED_IN'
              ? 'Name, age, blood group, allergies'
              : 'Signed out - history stays on this device'}
            icon="user"
            onPress={() => { tap('light'); onOpen('profile'); }}
          />
        </View>

        <View style={{ height: S.xl }} />

        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Txt t="bodyStrong">Theme</Txt>
              <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
                Follows your device unless you pick one
              </Txt>
            </View>

            <View style={[st.segment, { backgroundColor: P.sunken }]}>
              <Segment
                icon="sun"
                active={scheme === 'light'}
                onPress={() => { if (scheme !== 'light') { tap('light'); onToggleScheme(); } }}
                label="Light theme"
              />
              <Segment
                icon="moon"
                active={scheme === 'dark'}
                onPress={() => { if (scheme !== 'dark') { tap('light'); onToggleScheme(); } }}
                label="Dark theme"
              />
            </View>
          </View>
        </Card>

        <View style={{ height: S.xl }} />

        <SectionLabel>Your data</SectionLabel>
        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title="Records"
            subtitle={records === null
              ? 'Past assessments held on this device'
              : `${records} assessment${records === 1 ? '' : 's'} held on this device`}
            icon="records"
            onPress={() => { tap('light'); onOpen('records'); }}
          />
        </View>
        <Card>
          <Txt t="caption" c={P.muted}>
            Assessments are held only on this phone, signed in or not. They are
            not uploaded, and they do not survive uninstalling the app. Your
            health profile is separate: that is stored on your account.
          </Txt>
          <View style={{ height: S.lg }} />

          <Springy
            scaleTo={0.97}
            accessibilityLabel="Delete all records held on this device"
            onPress={() => {
              tap('warn');
              Alert.alert(
                'Delete all records?',
                records
                  ? `${records} assessment${records === 1 ? '' : 's'} will be removed from this device. This cannot be undone.`
                  : 'Every assessment will be removed from this device. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        await store.clear();
                        await store.clearActivity();
                        await count();
                        onDataCleared?.();
                      })();
                    },
                  },
                ],
              );
            }}
          >
            <Txt t="bodyStrong" c={P.danger}>Delete all records on this device</Txt>
          </Springy>
        </Card>

        <View style={{ height: S.xl }} />

        <SectionLabel>Support and legal</SectionLabel>

        <Card style={{ marginBottom: S.sm }}>
          <View style={st.row}>
            <Icon name="alert" size={18} color={P.warn} />
            <Txt t="bodyStrong" style={{ flex: 1 }}>Medical disclaimer</Txt>
          </View>
          <Txt t="caption" c={P.muted} style={{ marginTop: S.sm }}>
            PulsePoint gives general health information and is not a diagnosis.
            It does not replace advice from a doctor, pharmacist or nurse.
            Never delay seeking care because of something this app said. If you
            think you are having an emergency, call your local emergency
            number.
          </Txt>
        </Card>

        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title="Privacy policy"
            subtitle="What is collected, and how it is stored"
            icon="shield"
            onPress={() => { tap('light'); void Linking.openURL(PRIVACY_URL).catch(() => {}); }}
          />
        </View>
        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title="Terms of service"
            subtitle="The agreement covering your use of PulsePoint"
            icon="file"
            onPress={() => { tap('light'); void Linking.openURL(TERMS_URL).catch(() => {}); }}
          />
        </View>

        <View style={{ height: S.xxl }} />

        {session.state === 'SIGNED_IN' ? (
          <Springy
            scaleTo={0.97}
            accessibilityLabel="Sign out"
            onPress={() => {
              tap('warn');
              Alert.alert(
                'Sign out?',
                'Your records stay on this device. The AI Doctor conversation is cleared.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => { void onSignOut(); } },
                ],
              );
            }}
          >
            <View style={st.destructive}>
              <Txt t="bodyStrong" c={P.danger}>Sign out</Txt>
            </View>
          </Springy>
        ) : null}

        <Txt t="micro" c={P.faint} style={{ textAlign: 'center', marginTop: S.md }}>
          PulsePoint 0.1.0
        </Txt>
      </ScrollView>
    </View>
  );
}

function Segment({ icon, active, onPress, label }: {
  icon: 'sun' | 'moon'; active: boolean; onPress: () => void; label: string;
}) {
  const { c: P } = useTheme();
  return (
    <Springy
      onPress={onPress}
      scaleTo={0.9}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View style={[st.segmentItem, active ? { backgroundColor: P.surface } : null]}>
        <Icon name={icon} size={17} color={active ? P.accent : P.faint} />
      </View>
    </Springy>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md },

  segment: { flexDirection: 'row', borderRadius: R.pill, padding: 3, gap: 2 },
  segmentItem: {
    width: TOUCH - 6, height: TOUCH - 10, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
  },

  destructive: { alignItems: 'center', paddingVertical: S.lg },
});
