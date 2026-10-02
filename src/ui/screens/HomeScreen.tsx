import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { Session } from '../../domain/auth';
import { TriageBand } from '../../domain/entities';
import { checkInStreak, healthScore } from '../../domain/wellbeing';
import {
  BRIEFING_NOTICE, Conditions, ConditionsService, DashboardService,
  Intelligence, LocationState, ProfileService, RemoteOutcome,
} from '../../domain/remote';
import { Card, Txt, SectionLabel, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TAB_CLEARANCE } from '../theme';
import { TOP_BAR_HEIGHT } from '../nav/TopBar';

function ago(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const show = (n: number | null, suffix = ''): string =>
  n === null ? '-' : `${Math.round(n)}${suffix}`;

export function HomeScreen({
  store, session, refreshKey, dashboard, conditions, profile, onStartTriage,
}: {
  store: EpisodeStore;
  session: Session;
  refreshKey: number;
  dashboard: DashboardService;
  conditions: ConditionsService;
  profile?: ProfileService;
  onStartTriage: () => void;
}) {
  const { c: P } = useTheme();

  const [history, setHistory] = useState<readonly HistoryEntry[] | null>(null);
  const [intel, setIntel] = useState<RemoteOutcome<Intelligence> | null>(null);
  const [env, setEnv] = useState<{ state: LocationState; data: Conditions | null; notice: string | null } | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocal = useCallback(async () => {
    try { setHistory(await store.history(100)); } catch { setHistory([]); }
  }, [store]);

  const loadRemote = useCallback(async () => {
    void dashboard.intel(false).then((cached) => {
      setIntel((current) => (current?.status === 'OK' ? current : cached));
    });

    void dashboard.intel(true).then((fresh) => {
      if (fresh.status === 'OK') setIntel(fresh);
      else setIntel((current) => current ?? fresh);
    });

    void conditions.current().then(setEnv);

    if (profile) {
      void profile.me().then((r) => {
        if (r.status === 'OK' && r.data?.fullName?.trim()) {
          setProfileName(r.data.fullName.trim());
        }
      });
    }
  }, [dashboard, conditions, profile]);

  useEffect(() => { void loadLocal(); }, [loadLocal, refreshKey]);
  useEffect(() => { void loadRemote(); }, [loadRemote]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setIntel(null);
    await loadLocal();
    await loadRemote();
    setRefreshing(false);
  }, [loadLocal, loadRemote]);


  const score = useMemo(() => (history ? healthScore(history) : null), [history]);
  const streak = useMemo(() => (history ? checkInStreak(history) : null), [history]);

  const fullName = useMemo(() => {
    if (profileName) return profileName;
    const sessionName = session.displayName?.trim();
    if (!sessionName || sessionName === 'You') return null;
    return sessionName;
  }, [profileName, session.displayName]);

  const i = intel?.status === 'OK' ? intel.data : null;

  return (
    <ScrollView
      contentContainerStyle={[
        st.body,
        { paddingTop: TOP_BAR_HEIGHT + S.lg, paddingBottom: TAB_CLEARANCE + S.xxl },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.muted} />
      }
    >
      <Enter index={1}>
        <Txt t="display" style={st.greeting}>
          {fullName ? `Welcome back, ${fullName}.` : 'Welcome back.'}
        </Txt>
        {i?.dailyStatus && i.dailyStatus !== 'Unknown' ? (
          <Txt t="micro" c={P.muted} style={st.eyebrow}>
            {`TODAY - ${i.dailyStatus.toUpperCase()}`}
          </Txt>
        ) : null}
      </Enter>

      <Enter index={3}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Today's intelligence</SectionLabel>
        <IntelCard outcome={intel} />
      </Enter>

      {i && i.digitalTwin.pattern ? (
        <Enter index={4}>
          <View style={{ height: S.lg }} />
          <Card style={st.wide}>
            <Txt t="micro" c={P.muted} style={st.eyebrowTight}>HEALTH PATTERN</Txt>
            <Txt t="bodyStrong" style={{ marginTop: 6 }}>{i.digitalTwin.pattern}</Txt>
          </Card>
        </Enter>
      ) : null}

      <Enter index={5}>
        <View style={{ height: S.lg }} />
        <View style={st.pair}>
          <Card style={[st.half, score ? { backgroundColor: P.accentSoft } : null]}>
            <Txt t="micro" c={P.muted} style={st.eyebrowTight}>HEALTH SCORE</Txt>
            {score ? (
              <>
                <View style={st.scoreRow}>
                  <Txt t="display" c={P.accent}>{score.value}</Txt>
                  <Txt t="caption" c={P.muted} style={{ marginBottom: 6 }}> / 100</Txt>
                </View>
                <Txt t="micro" c={P.muted}>
                  {`from ${score.episodeCount} check-${score.episodeCount === 1 ? 'in' : 'ins'} in ${score.windowDays} days`}
                </Txt>
              </>
            ) : (

              <Pressable
                onPress={onStartTriage}
                accessibilityRole="button"
                accessibilityLabel="Check symptoms to start your health score"
                style={({ pressed }) => [{ marginTop: 4 }, pressed && { opacity: 0.6 }]}
              >
                <Txt t="bodyStrong" c={P.accent}>Check in</Txt>
                <Txt t="micro" c={P.muted} style={{ marginTop: 2 }}>
                  Your score starts after one assessment
                </Txt>
              </Pressable>
            )}
          </Card>

          <Card style={st.half}>
            <Txt t="micro" c={P.muted} style={st.eyebrowTight}>STREAK</Txt>
            <View style={st.scoreRow}>
              <Txt t="display">{streak ? streak.days : 0}</Txt>
              <Txt t="caption" c={P.muted} style={{ marginBottom: 6 }}>
                {` day${streak?.days === 1 ? '' : 's'}`}
              </Txt>
            </View>
            <Txt t="micro" c={P.muted}>
              {streak?.atRisk ? 'Check in today to keep it' : 'Consecutive days checked in'}
            </Txt>
          </Card>
        </View>
      </Enter>

      {score && score.reasons.length > 0 ? (
        <Enter index={6}>
          <View style={{ height: S.lg }} />
          <Card style={{ padding: S.lg }}>
            <Txt t="micro" c={P.muted} style={st.eyebrowTight}>HOW THIS WAS WORKED OUT</Txt>
            {score.reasons.map((r) => (
              <View key={r.label} style={st.reasonRow}>
                <Txt t="caption" style={{ flex: 1 }}>{r.label}</Txt>
                <Txt t="numeric" c={P.muted}>{r.delta}</Txt>
              </View>
            ))}
            <Txt t="micro" c={P.faint} style={{ marginTop: S.sm }}>
              A summary of what this app has recorded - not a measure of your
              health. It cannot see anything you have not entered.
            </Txt>
          </Card>
        </Enter>
      ) : null}

      <Enter index={7}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Environmental pulse</SectionLabel>
        <EnvCard
          env={env}
          analysis={i?.environmentalAnalysis ?? ''}
          onRetry={() => { setEnv(null); void conditions.current().then(setEnv); }}
        />
      </Enter>
    </ScrollView>
  );
}

function IntelCard({ outcome }: { outcome: RemoteOutcome<Intelligence> | null }) {
  const { c: P } = useTheme();

  if (outcome === null) {
    return (
      <Card style={{ padding: S.lg }}>
        <Txt t="caption" c={P.muted}>Syncing…</Txt>
      </Card>
    );
  }

  if (outcome.status !== 'OK' || !outcome.data) {
    return (
      <Card style={{ padding: S.lg }}>
        <View style={st.noticeRow}>
          <Icon name="alert" size={15} color={P.muted} />
          <Txt t="caption" c={P.muted} style={{ flex: 1 }}>
            {BRIEFING_NOTICE[outcome.status as Exclude<typeof outcome.status, 'OK'>]
              ?? 'Today’s briefing is unavailable.'}
          </Txt>
        </View>
      </Card>
    );
  }

  const i = outcome.data;

  return (
    <Card style={{ padding: S.lg, borderColor: P.accentSoft, borderWidth: 1 }}>
      <View style={st.noticeRow}>
        <Icon name="pulse" size={14} color={P.accent} />
        <Txt t="micro" c={P.accent} style={st.eyebrowTight}>TODAY'S INTELLIGENCE</Txt>
      </View>

      {i.dailyTip ? (
        <Txt t="title" style={{ marginTop: S.md }}>{i.dailyTip}</Txt>
      ) : null}

      {i.intelligenceBrief ? (
        <Txt t="body" c={P.inkSoft} style={{ marginTop: S.md }}>{i.intelligenceBrief}</Txt>
      ) : null}

      {i.digitalTwin.medInsight ? (
        <Txt t="caption" c={P.muted} style={{ marginTop: S.md }}>
          {i.digitalTwin.medInsight}
        </Txt>
      ) : null}

      <Txt t="micro" c={P.faint} style={{ marginTop: S.lg }}>
        {i.model
          ? `Generated by ${i.model}${i.generationSeconds ? ` in ${i.generationSeconds.toFixed(1)}s` : ''}. Not a diagnosis.`
          : 'Automatically generated. Not a diagnosis.'}
      </Txt>
    </Card>
  );
}

function EnvCard({
  env, analysis, onRetry,
}: {
  env: { state: LocationState; data: Conditions | null; notice: string | null } | null;
  analysis: string;
  onRetry: () => void;
}) {
  const { c: P } = useTheme();

  if (env === null) {
    return (
      <Card style={{ padding: S.lg }}>
        <Txt t="caption" c={P.muted}>Reading conditions…</Txt>
      </Card>
    );
  }

  if (env.state !== 'OK' || !env.data) {
    return (
      <Card style={{ padding: S.lg }}>
        <View style={st.noticeRow}>
          <Icon name="pin" size={15} color={P.muted} />
          <Txt t="caption" c={P.muted} style={{ flex: 1 }}>
            {env.notice ?? 'Conditions are unavailable.'}
          </Txt>
        </View>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry reading conditions"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [{ marginTop: S.md }, pressed && { opacity: 0.6 }]}
        >
          <Txt t="label" c={P.accent}>Try again</Txt>
        </Pressable>
      </Card>
    );
  }

  const d = env.data;

  return (
    <Card style={{ padding: S.lg }}>
      {d.place ? (
        <View style={[st.placeRow, { borderBottomColor: P.line }]}>
          <Icon name="pin" size={14} color={P.muted} />
          <Txt t="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{d.place}</Txt>
          {d.source !== 'device' ? (
            <Txt t="micro" c={P.faint}>approximate</Txt>
          ) : null}
        </View>
      ) : null}

      <View style={st.metrics}>
        <Metric icon="sun" label="UV INDEX" value={show(d.uvIndex)} />
        <Metric icon="search" label="AQI" value={show(d.aqi)} />
        <Metric icon="clock" label="HUMIDITY" value={show(d.humidity, '%')} />
      </View>

      {analysis ? (
        <>
          <View style={[st.rule, { backgroundColor: P.line }]} />
          <Txt t="caption" c={P.inkSoft}>{analysis}</Txt>
        </>
      ) : null}

      <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
        {d.source === 'device'
          ? 'Live from Open-Meteo for your current location. Coordinates are used for this lookup only and are not stored.'
          : d.source === 'network'
            ? 'Live from Open-Meteo for your approximate area, resolved from your connection. Nothing is stored.'
            : 'Live from Open-Meteo, located by your device time zone. Turn on location for readings where you actually are.'}
      </Txt>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: 'sun' | 'search' | 'clock'; label: string; value: string }) {
  const { c: P } = useTheme();
  return (
    <View style={st.metric}>
      <View style={[st.metricIcon, { backgroundColor: P.sunken }]}>
        <Icon name={icon} size={18} color={P.ink} />
      </View>
      <Txt t="micro" c={P.muted} style={{ marginTop: S.sm, letterSpacing: 1.2 }}>{label}</Txt>
      <Txt t="title" style={{ marginTop: 2 }}>{value}</Txt>
    </View>
  );
}


const st = StyleSheet.create({
  body: { paddingHorizontal: S.xl },
  greeting: { letterSpacing: -1 },
  eyebrow: { marginTop: 6, letterSpacing: 2 },
  eyebrowTight: { letterSpacing: 1.4 },

  pair: { flexDirection: 'row', gap: S.md },
  wide: { padding: S.lg },
  half: { flex: 1, padding: S.lg, minHeight: 104, justifyContent: 'center' },

  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: S.sm, marginTop: S.sm,
  },

  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingBottom: S.md, marginBottom: S.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metrics: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center', flex: 1 },
  metricIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },

  rule: { height: StyleSheet.hairlineWidth, marginVertical: S.lg },

  bandHead: { padding: S.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sevPill: {
    minWidth: 40, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: R.pill, alignItems: 'center',
  },

  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
});
