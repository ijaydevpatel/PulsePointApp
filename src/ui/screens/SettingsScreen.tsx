/**
 * App preferences, grouped the way Android's settings guidance groups them.
 *
 * ── What is deliberately not here ────────────────────────────────────────────
 *
 * Notification toggles, biometric lock, wearable syncing, data-sharing
 * permissions and an export/delete dashboard were all asked for, and none of
 * them is here, because none of them exists. The app has no push
 * registration, no biometric prompt, no Health Connect integration and no
 * export endpoint.
 *
 * A switch that saves a preference nothing reads is worse than a missing
 * switch, and worse here than in most apps: someone who turns on "require
 * fingerprint to open" and believes it has a false idea of who can read their
 * medical history. The same goes for a "delete my health data" button that
 * deletes nothing. These belong here the day the thing behind them works, and
 * not before.
 *
 * What remains is the set that does something: the theme, the records held on
 * this device, the legal text, and signing out.
 *
 * ── Toggles save instantly ───────────────────────────────────────────────────
 *
 * No Save button on this screen. A switch has one obvious meaning and the
 * change is visible the moment it happens, so a confirmation step would only
 * add a way to lose the change. The profile form is the opposite case and
 * behaves the opposite way.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, NavCard, SectionLabel, Txt, Springy, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Scheme } from '../theme';
import { Session } from '../../domain/auth';
import { EpisodeStore } from '../../domain/ports';
import { RouteKey } from '../nav/routes';

/** Where the legal text lives. The website is the source of truth for both. */
const PRIVACY_URL = 'https://pulsepoint-ekqb.onrender.com/privacy';
const TERMS_URL = 'https://pulsepoint-ekqb.onrender.com/terms';

export function SettingsScreen({
  session, store, scheme, onToggleScheme, onBack, onOpen, onSignOut, historyKey,
  onDataCleared,
}: {
  session: Session;
  store: EpisodeStore;
  scheme: Scheme;
  onToggleScheme: () => void;
  onBack: () => void;
  onOpen: (r: RouteKey) => void;
  onSignOut: () => void | Promise<void>;
  /** Changes when an assessment is stored, so the count stays honest. */
  historyKey?: number;
  /** Lets the rest of the app know the local history is gone. */
  onDataCleared?: () => void;
}) {
  const { c: P } = useTheme();
  const [records, setRecords] = useState<number | null>(null);

  const count = useCallback(async () => {
    try {
      const all = await store.history(500);
      setRecords(all.length);
    } catch {
      // A count that cannot be read is not worth an error state; the row
      // simply does not claim a number.
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
            title={session.displayName ?? 'Your profile'}
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

            {/*
              Two explicit choices rather than a single switch. "Dark mode
              on/off" cannot express "follow the device", which is the state
              most people are actually in.
            */}
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
          {/*
            This said assessments sync to your account when signed in. They do
            not: EpisodeStore has pendingSync and markSynced, nothing calls
            them, and the backend has no episode route at all. Writing the
            claim into the UI would have been the exact failure this project
            keeps finding - a screen asserting something nobody implemented.
          */}
          <Txt t="caption" c={P.muted}>
            Assessments are held only on this phone, signed in or not. They are
            not uploaded, and they do not survive uninstalling the app. Your
            health profile is separate: that is stored on your account.
          </Txt>
          <View style={{ height: S.lg }} />

          {/*
            A real deletion, not a gesture: EpisodeStore.clear() drops every
            row. It is here rather than in a "data controls" dashboard because
            it is the only part of such a dashboard this app can actually
            honour, and a button that deletes what it says it deletes is worth
            more than a page of ones that do not.
          */}
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

        {/*
          The disclaimer is text rather than a link, because it is the one
          thing on this screen a person should not have to tap to find, and
          the one a medical app is most often criticised for burying.
        */}
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

        {/*
          Destructive last, and confirmed - the Android pattern, and the one
          place on this screen where a mis-tap costs something.
        */}
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
