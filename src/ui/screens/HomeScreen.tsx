/**
 * Home — a health summary, not a launcher.
 *
 * The five things you come here to do are one tap away in the tab bar, so
 * repeating them as a grid of shortcuts would add a screen you have to read
 * past. This answers a different question: where do I stand right now.
 *
 * Three things, in the order they matter:
 *
 *   1. the last triage band, and how old it is
 *   2. red flags that fired in that episode
 *   3. how many episodes the device is holding
 *
 * ── On staleness ─────────────────────────────────────────────────────────────
 *
 * A triage band is a statement about how someone was feeling at a moment, and
 * it stops being true. The card says when it was taken and, past a day, says
 * plainly that it may no longer hold rather than presenting a stale band as
 * current. Showing "URGENT" from last week with no date would be worse than
 * showing nothing.
 *
 * ── On the empty state ───────────────────────────────────────────────────────
 *
 * With no history this screen has nothing to summarise, and inventing
 * something — a wellness score, a tip of the day — would be filling space with
 * material the app cannot stand behind. It says what is missing and points at
 * the tab that fixes it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { Session } from '../../domain/auth';
import { TriageBand } from '../../domain/entities';
import { Card, Txt, SectionLabel, EmptyState, Button, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TAB_CLEARANCE } from '../theme';
import { TOP_BAR_HEIGHT } from '../nav/TopBar';

/** "just now" / "3 hours ago" / "5 days ago". */
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

/** Past this, a band is described as possibly out of date. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function HomeScreen({
  store, session, refreshKey, onStartTriage,
}: {
  store: EpisodeStore;
  session: Session;
  /** Bumped by the app whenever an episode is saved. */
  refreshKey: number;
  onStartTriage: () => void;
}) {
  const { c: P, band: BAND } = useTheme();
  const [history, setHistory] = useState<readonly HistoryEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setHistory(await store.history(20));
    } catch {
      // A read failure is an empty summary, never a crash on the first screen.
      setHistory([]);
    }
  }, [store]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const latest = history?.[0] ?? null;
  const takenAt = latest?.episode.capturedAt ?? null;
  const stale = takenAt ? Date.now() - new Date(takenAt).getTime() > STALE_AFTER_MS : false;

  const first = session.displayName?.trim().split(/\s+/)[0] ?? null;

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
          {first ? `Hello, ${first}.` : 'Hello.'}
        </Txt>
        <Txt t="caption" c={P.muted} style={{ marginTop: 4 }}>
          {latest ? 'Here is where things stand.' : 'Nothing recorded yet.'}
        </Txt>
      </Enter>

      {history === null ? null : latest ? (
        <>
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

          {latest.result.redFlags.length > 0 ? (
            <Enter index={3}>
              <View style={{ height: S.xxl }} />
              <SectionLabel>Flagged in that episode</SectionLabel>
              <Card style={{ padding: S.lg }}>
                {latest.result.redFlags.map((f, i) => (
                  <View key={`${f}-${i}`} style={st.flagRow}>
                    <Icon name="alert" size={15} color={P.danger} />
                    <Txt t="body" style={{ flex: 1 }}>{f}</Txt>
                  </View>
                ))}
              </Card>
            </Enter>
          ) : null}

          <Enter index={4}>
            <View style={{ height: S.xxl }} />
            <SectionLabel>On this device</SectionLabel>
            <Card style={{ padding: S.lg }}>
              <View style={st.statRow}>
                <Icon name="records" size={17} color={P.muted} />
                <Txt t="body" style={{ flex: 1 }}>
                  {history.length === 1
                    ? '1 episode stored'
                    : `${history.length} episodes stored`}
                </Txt>
              </View>
              <Txt t="caption" c={P.muted} style={{ marginTop: 6 }}>
                Held encrypted on the phone. Open Records from your account to
                read or delete them.
              </Txt>
            </Card>
          </Enter>
        </>
      ) : (
        <Enter index={2}>
          <View style={{ height: S.xl }} />
          <EmptyState
            icon="pulse"
            title="No assessments yet"
            body="Check how you're feeling and PulsePoint will summarise it here."
            action={<Button title="Check symptoms" onPress={onStartTriage} icon="arrowRight" />}
          />
        </Enter>
      )}
    </ScrollView>
  );
}

/**
 * The band, in the palette the result screen uses.
 *
 * Colour is never the only signal: the band's own word is always present, and
 * so is the severity figure. Someone who cannot separate the amber from the
 * red reads exactly the same information.
 */
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
        <Txt t="micro" c={b.onSolid} style={st.eyebrow}>RECOMMENDED</Txt>
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

  bandHead: { padding: S.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { letterSpacing: 1.6 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sevPill: {
    minWidth: 40, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: R.pill, alignItems: 'center',
  },

  flagRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: S.sm, marginBottom: S.xs,
  },
});
