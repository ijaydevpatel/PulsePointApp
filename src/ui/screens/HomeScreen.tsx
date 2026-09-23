/**
 * Home — the website's dashboard composition, in the app's palette.
 *
 * Card order follows the site: today's intelligence, then the digital-twin
 * pair (pattern / risk trend), then score and streak, then environment. The
 * "Intelligence Briefing" card the site carries is deliberately absent.
 *
 * ── What is real, and what the site got wrong ────────────────────────────────
 *
 * Today's Intelligence, the pattern and the risk trend are genuine: GPT-OSS-120B
 * on Groq generates them from the signed-in profile. Home asks for a fresh one
 * on every open — the route caches for thirty minutes by default, which made
 * the tip the same sentence all afternoon — and the server keeps the last good
 * value so a failed regeneration falls back rather than showing nothing. The
 * last twenty tips are withheld from the model so it cannot circle the same
 * three suggestions.
 *
 * The model and generation time are shown rather than hidden, because it is
 * model output about someone's health and pretending otherwise is the problem.
 *
 * Two cards work differently here than on the site:
 *
 *   Score and streak — the backend declares `healthScore` (default 100) and
 *   `streak` (default 0) and never writes either, so every account on the web
 *   reads 100/100 on no data. Both are computed on the device from real
 *   episode history (src/domain/wellbeing.ts), and when there is no history
 *   they say so instead of showing a number.
 *
 *   Environment — the backend returns a fixed { aqi: 38, uv: 5, humidity: 62 }
 *   marked "static fallback". These come from Open-Meteo for the device's
 *   actual coordinates, and every field can be null, which renders as an
 *   em dash rather than as a plausible-looking default.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────────
 *
 * The local triage summary sits above the AI cards. A band this app computed
 * from symptoms the person entered is better evidence than a language model's
 * impression of their profile, so it reads first.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { Session } from '../../domain/auth';
import { TriageBand } from '../../domain/entities';
import { checkInStreak, healthScore } from '../../domain/wellbeing';
import {
  Conditions, ConditionsService, DashboardService, Intelligence,
  LocationState, RemoteOutcome,
} from '../../domain/remote';
import { Card, Txt, SectionLabel, Button, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TAB_CLEARANCE } from '../theme';
import { TOP_BAR_HEIGHT } from '../nav/TopBar';

/* ────────────────────────────── helpers ─────────────────────────────────── */

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

/** Null renders as an em dash. Never as zero, and never as a default. */
const show = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

/* ───────────────────────────────  screen  ───────────────────────────────── */

export function HomeScreen({
  store, session, refreshKey, dashboard, conditions, onStartTriage,
}: {
  store: EpisodeStore;
  session: Session;
  refreshKey: number;
  dashboard: DashboardService;
  conditions: ConditionsService;
  onStartTriage: () => void;
}) {
  const { c: P } = useTheme();

  const [history, setHistory] = useState<readonly HistoryEntry[] | null>(null);
  const [intel, setIntel] = useState<RemoteOutcome<Intelligence> | null>(null);
  const [env, setEnv] = useState<{ state: LocationState; data: Conditions | null; notice: string | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocal = useCallback(async () => {
    try { setHistory(await store.history(100)); } catch { setHistory([]); }
  }, [store]);

  /*
   * The three sources load independently and none blocks another. The local
   * summary is on the device and lands immediately; the briefing can take
   * seconds; conditions wait on a permission prompt the person may never
   * answer. Awaiting them together would hold the whole screen at the speed of
   * the slowest.
   */
  const loadRemote = useCallback(async () => {
    // fresh: the tip should be new guidance each time the app is opened, not
    // the same sentence for half an hour.
    void dashboard.intel(true).then(setIntel);
    void conditions.current().then(setEnv);
  }, [dashboard, conditions]);

  useEffect(() => { void loadLocal(); }, [loadLocal, refreshKey]);
  useEffect(() => { void loadRemote(); }, [loadRemote]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setIntel(null);
    await loadLocal();
    await loadRemote();
    setRefreshing(false);
  }, [loadLocal, loadRemote]);

  const latest = history?.[0] ?? null;
  const takenAt = latest?.episode.capturedAt ?? null;
  const stale = takenAt ? Date.now() - new Date(takenAt).getTime() > STALE_AFTER_MS : false;

  const score = useMemo(() => (history ? healthScore(history) : null), [history]);
  const streak = useMemo(() => (history ? checkInStreak(history) : null), [history]);

  const first = session.displayName?.trim().split(/\s+/)[0] ?? null;
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
          {first ? `Welcome back, ${first}.` : 'Welcome back.'}
        </Txt>
        {i?.dailyStatus && i.dailyStatus !== 'Unknown' ? (
          <Txt t="micro" c={P.muted} style={st.eyebrow}>
            {`TODAY — ${i.dailyStatus.toUpperCase()}`}
          </Txt>
        ) : null}
      </Enter>

      {/* ── last assessment: device evidence, so it leads ─────────────── */}
      {latest ? (
        <Enter index={2}>
          <View style={{ height: S.xxl }} />
          <SectionLabel>Last assessment</SectionLabel>
          <BandCard
            band={latest.result.band}
            severity={latest.result.severity}
            takenAt={takenAt!}
            stale={stale}
          />
        </Enter>
      ) : history !== null ? (
        <Enter index={2}>
          <View style={{ height: S.xxl }} />
          <Card style={{ padding: S.lg }}>
            <Txt t="bodyStrong">No assessments yet</Txt>
            <Txt t="caption" c={P.muted} style={{ marginTop: 6 }}>
              Check how you're feeling and the summary here will fill in.
            </Txt>
            <View style={{ marginTop: S.lg }}>
              <Button title="Check symptoms" onPress={onStartTriage} icon="arrowRight" />
            </View>
          </Card>
        </Enter>
      ) : null}

      {/* ── today's intelligence ──────────────────────────────────────── */}
      <Enter index={3}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Today's intelligence</SectionLabel>
        <IntelCard outcome={intel} />
      </Enter>

      {/* ── digital twin pair ─────────────────────────────────────────── */}
      {i && (i.digitalTwin.pattern || i.digitalTwin.riskTrend !== 'Unknown') ? (
        <Enter index={4}>
          <View style={{ height: S.lg }} />
          <View style={st.pair}>
            <Card style={st.half}>
              <Txt t="micro" c={P.muted} style={st.eyebrowTight}>HEALTH PATTERN</Txt>
              <Txt t="bodyStrong" style={{ marginTop: 6 }}>
                {i.digitalTwin.pattern || '—'}
              </Txt>
            </Card>
            <Card style={st.half}>
              <Txt t="micro" c={P.muted} style={st.eyebrowTight}>RISK TREND</Txt>
              <Txt t="bodyStrong" style={{ marginTop: 6 }}>
                {i.digitalTwin.riskTrend === 'Unknown' ? '—' : i.digitalTwin.riskTrend}
              </Txt>
            </Card>
          </View>
        </Enter>
      ) : null}

      {/* ── score and streak ──────────────────────────────────────────── */}
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
              <>
                <Txt t="title" c={P.muted} style={{ marginTop: 4 }}>—</Txt>
                <Txt t="micro" c={P.muted}>Nothing recorded yet</Txt>
              </>
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

      {/* ── how the score was reached ─────────────────────────────────── */}
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
              A summary of what this app has recorded — not a measure of your
              health. It cannot see anything you have not entered.
            </Txt>
          </Card>
        </Enter>
      ) : null}

      {/* ── environmental pulse ───────────────────────────────────────── */}
      <Enter index={7}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Environmental pulse</SectionLabel>
        <EnvCard env={env} analysis={i?.environmentalAnalysis ?? ''} />
      </Enter>
    </ScrollView>
  );
}

/* ──────────────────────────── intelligence ──────────────────────────────── */

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
            {outcome.notice ?? 'Today’s briefing is unavailable.'}
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

      {/*
       * Attribution, not decoration. This is a language model's impression of
       * a profile, and the person reading it is entitled to know that before
       * they act on it.
       */}
      <Txt t="micro" c={P.faint} style={{ marginTop: S.lg }}>
        {i.model
          ? `Generated by ${i.model}${i.generationMs ? ` in ${(i.generationMs / 1000).toFixed(1)}s` : ''}. Not a diagnosis.`
          : 'Automatically generated. Not a diagnosis.'}
      </Txt>
    </Card>
  );
}

/* ──────────────────────────── environment ───────────────────────────────── */

function EnvCard({
  env, analysis,
}: {
  env: { state: LocationState; data: Conditions | null; notice: string | null } | null;
  analysis: string;
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
      </Card>
    );
  }

  const d = env.data;

  return (
    <Card style={{ padding: S.lg }}>
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
        Open-Meteo, for your current location. Coordinates are used for this
        lookup only and are not stored.
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

/* ────────────────────────────── band card ───────────────────────────────── */

function BandCard({
  band, severity, takenAt, stale,
}: {
  band: TriageBand; severity: number; takenAt: string; stale: boolean;
}) {
  const { c: P, band: BAND } = useTheme();
  const b = BAND[band];

  return (
    <Card padded={false} elevated={2} style={{ overflow: 'hidden' }}>
      <View style={[st.bandHead, { backgroundColor: b.solid, borderBottomColor: b.solidEdge }]}>
        <Txt t="micro" c={b.onSolid} style={st.eyebrowTight}>RECOMMENDED</Txt>
        <Txt t="title" c={b.onSolid} style={{ marginTop: 2 }}>{b.label}</Txt>
      </View>

      <View style={{ padding: S.lg }}>
        <View style={st.statRow}>
          <Icon name="clock" size={16} color={P.muted} />
          <Txt t="body" style={{ flex: 1 }}>Taken {ago(takenAt)}</Txt>
          <View style={[st.sevPill, { backgroundColor: P.sunken }]}>
            <Txt t="numeric" c={P.ink}>{Math.round(severity)}</Txt>
          </View>
        </View>

        {stale ? (
          <Txt t="caption" c={P.muted} style={{ marginTop: 8 }}>
            This was more than a day ago and may no longer describe how you
            feel. Check again if anything has changed.
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: S.xl },
  greeting: { letterSpacing: -1 },
  eyebrow: { marginTop: 6, letterSpacing: 2 },
  eyebrowTight: { letterSpacing: 1.4 },

  pair: { flexDirection: 'row', gap: S.md },
  half: { flex: 1, padding: S.lg, minHeight: 104, justifyContent: 'center' },

  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: S.sm, marginTop: S.sm,
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
