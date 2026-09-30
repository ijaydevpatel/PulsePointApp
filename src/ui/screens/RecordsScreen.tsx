import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ScrollView, Alert } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Card, EmptyState, SectionLabel, Button, Txt, Springy, Enter,
} from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { Icon } from '../components/Icon';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { ActivityEntry, ActivityLog, ACTIVITY_LABEL } from '../../domain/activity';
import { BAND_LABEL } from '../../domain/entities';
import { useTheme, S, TOUCH, TAB_CLEARANCE } from '../theme';

function summarise(entry: HistoryEntry): string {
  const names = entry.episode.symptoms.map((s) => s.label);
  if (names.length === 0) return 'Symptom check';
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString();
}

export function RecordsScreen({ store, refreshKey, onBack }: {
  store: EpisodeStore & ActivityLog;
  refreshKey: number;

  onBack?: () => void;
}) {
  const { c: P, band: B } = useTheme();
  const [rows, setRows] = useState<readonly HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<HistoryEntry | null>(null);

  const [trace, setTrace] = useState<readonly ActivityEntry[]>([]);

  const load = useCallback(async () => {
    const [checks, activity] = await Promise.all([store.history(100), store.recent(200)]);
    setRows(checks);
    setTrace(activity);
    setLoaded(true);
  }, [store]);

  const byEpisode = new Map(rows.map((r) => [r.episode.id, r]));
  const items = trace.map((a) => ({
    activity: a,
    check: a.episodeId ? byEpisode.get(a.episodeId) ?? null : null,
  }));

  useEffect(() => { void load(); }, [load, refreshKey]);

  const remove = (id: string) => {
    Alert.alert('Delete this check?', 'It will be removed from this device permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => { await store.remove(id); await load(); } },
    ]);
  };

  if (open) {
    return <CheckDetail entry={open} onBack={() => setOpen(null)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Records" subtitle="Stored encrypted on this device only" onBack={onBack} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.activity.id}
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={items.length ? <SectionLabel>Everything you have done</SectionLabel> : undefined}
        ListEmptyComponent={loaded ? (
          <EmptyState
            icon="clock"
            title="Nothing here yet"
            body="Symptom checks, medicine checks and care searches are saved here, encrypted, so you can look back at them."
          />
        ) : undefined}
        renderItem={({ item, index }) => {
          const { activity, check } = item;

          return (
            <Enter index={Math.min(index, 8)}>
              <Card
                style={{ marginBottom: S.sm }}
                onPress={check ? () => setOpen(check) : undefined}
              >
                <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
                  {check
                    ? <SeveritySpine band={check.result.band} height={42} width={5} />
                    : <View style={{ width: 5, height: 42, borderRadius: 3, backgroundColor: P.line }} />}

                  <View style={{ flex: 1 }}>
                    <Txt t="bodyStrong" numberOfLines={2}>{activity.title}</Txt>
                    <Txt t="caption" c={P.muted} style={{ marginTop: 3 }}>
                      {`${ACTIVITY_LABEL[activity.kind]} · ${when(activity.at)}`}
                    </Txt>
                    {activity.detail ? (
                      <Txt
                        t="caption"
                        c={check ? B[check.result.band].fg : P.muted}
                        style={{ marginTop: 1 }}
                      >
                        {activity.detail}
                      </Txt>
                    ) : null}
                  </View>

                  {check ? (
                    <Springy
                      onPress={() => remove(check.episode.id)}
                      scaleTo={0.85}
                      weight="warn"
                      accessibilityLabel={`Delete check from ${when(activity.at)}`}
                      style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="trash" size={18} color={P.faint} />
                    </Springy>
                  ) : (
                    <Icon name="chevronRight" size={16} color={P.faint} />
                  )}
                </View>
              </Card>
            </Enter>
          );
        }}
        ListFooterComponent={items.length > 1 ? (
          <View style={{ marginTop: S.xl }}>
            <Button title="Delete all records" tone="danger" icon="trash" onPress={() => {
              Alert.alert('Delete everything?', 'Every check and every history entry will be removed from this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive',
                  onPress: async () => {
                    await store.clear();
                    await store.clearActivity();
                    await load();
                  } },
              ]);
            }} />
          </View>
        ) : undefined}
      />
    </View>
  );
}

function CheckDetail({ entry, onBack }: { entry: HistoryEntry; onBack: () => void }) {
  const { c: P, band: B } = useTheme();
  const { episode, result } = entry;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={summarise(entry)} subtitle={when(episode.capturedAt)} onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: S.sm }}>
          <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
            <SeveritySpine band={result.band} height={48} width={6} />
            <View style={{ flex: 1 }}>
              <Txt t="bodyStrong" c={B[result.band].fg}>{BAND_LABEL[result.band]}</Txt>
              <Txt t="caption" style={{ marginTop: 3 }}>
                {`${result.severity}/100 · ${Math.round(result.confidence * 100)}% confidence`}
              </Txt>
            </View>
          </View>
        </Card>

        <SectionLabel>What was reported</SectionLabel>
        <Card style={{ marginBottom: S.sm }}>
          {episode.symptoms.length === 0 ? (
            <Txt t="caption">Described in free text rather than picked from the list.</Txt>
          ) : (
            episode.symptoms.map((sym, i) => (
              <View key={sym.code} style={{ marginTop: i === 0 ? 0 : S.sm }}>
                <Txt t="body">{`${sym.label} at ${sym.severity}/10`}</Txt>
              </View>
            ))
          )}
          <Txt t="caption" style={{ marginTop: S.md }}>
            {`Going on for about ${episode.durationHours} hour${episode.durationHours === 1 ? '' : 's'}`}
          </Txt>
        </Card>

        {result.redFlags.length > 0 ? (
          <>
            <SectionLabel>Red flags</SectionLabel>
            <Card style={{ marginBottom: S.sm }}>
              {result.redFlags.map((f) => (
                <Txt key={f} t="body" c={P.danger} style={{ marginTop: 2 }}>{f}</Txt>
              ))}
            </Card>
          </>
        ) : null}

        {result.rationale.length > 0 ? (
          <>
            <SectionLabel>Why</SectionLabel>
            <Card style={{ marginBottom: S.sm }}>
              {result.rationale.map((r, i) => (
                <Txt key={r} t="body" style={{ marginTop: i === 0 ? 0 : S.sm }}>{r}</Txt>
              ))}
            </Card>
          </>
        ) : null}

        <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
          {result.syncStatus === 'PENDING_SYNC'
            ? 'Checked on this device. A fuller explanation is added when you are back online.'
            : 'Checked against the clinical engine.'}
        </Txt>
      </ScrollView>
    </View>
  );
}
