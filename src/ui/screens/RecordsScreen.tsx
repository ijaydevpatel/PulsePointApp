/** FR5 - encrypted history, review and delete. Wired to the real store. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ScrollView, Alert } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Card, EmptyState, SectionLabel, Button, Txt, Springy, Enter,
} from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { Icon } from '../components/Icon';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { BAND_LABEL } from '../../domain/entities';
import { useTheme, S, TOUCH, TAB_CLEARANCE } from '../theme';

/** The symptoms, as a sentence. The question the check was asked. */
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
  store: EpisodeStore;
  refreshKey: number;
  /** Present now that Records is reached from the account sheet rather than
   *  from a tab - a pushed screen needs a way back. */
  onBack?: () => void;
}) {
  const { c: P, band: B } = useTheme();
  const [rows, setRows] = useState<readonly HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<HistoryEntry | null>(null);

  const load = useCallback(async () => {
    setRows(await store.history(100));
    setLoaded(true);
  }, [store]);

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
        data={rows}
        keyExtractor={(r) => r.episode.id}
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={rows.length ? <SectionLabel>Past checks</SectionLabel> : undefined}
        ListEmptyComponent={loaded ? (
          <EmptyState
            icon="clock"
            title="No checks yet"
            body="Symptom checks you run will be saved here, encrypted, so you can look back at them."
          />
        ) : undefined}
        renderItem={({ item, index }) => (
          <Enter index={Math.min(index, 8)}>
            <Card style={{ marginBottom: S.sm }} onPress={() => setOpen(item)}>
              <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
                <SeveritySpine band={item.result.band} height={42} width={5} />
                <View style={{ flex: 1 }}>
                  {/*
                    What was reported, not what was advised.
                    
                    The row used to lead with the band - "See a pharmacist or
                    GP" - which is the answer, not the question. Every check
                    that landed in the same band read identically, so a list
                    of them said nothing about which was which. The symptoms
                    are what the person remembers doing.
                  */}
                  <Txt t="bodyStrong" numberOfLines={2}>{summarise(item)}</Txt>
                  <Txt t="caption" c={B[item.result.band].fg} style={{ marginTop: 3 }}>
                    {BAND_LABEL[item.result.band]}
                  </Txt>
                  <Txt t="caption" style={{ marginTop: 1 }}>
                    {`${when(item.episode.capturedAt)} · ${item.result.severity}/100`}
                  </Txt>
                  {item.result.syncStatus === 'PENDING_SYNC' ? (
                    <Txt t="micro" style={{ marginTop: 3 }}>Not yet enriched</Txt>
                  ) : null}
                </View>
                <Springy
                  onPress={() => remove(item.episode.id)}
                  scaleTo={0.85}
                  weight="warn"
                  accessibilityLabel={`Delete check from ${when(item.episode.capturedAt)}`}
                  style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="trash" size={18} color={P.faint} />
                </Springy>
              </View>
            </Card>
          </Enter>
        )}
        ListFooterComponent={rows.length > 1 ? (
          <View style={{ marginTop: S.xl }}>
            <Button title="Delete all records" tone="danger" icon="trash" onPress={() => {
              Alert.alert('Delete everything?', 'All saved checks will be removed from this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive',
                  onPress: async () => { await store.clear(); await load(); } },
              ]);
            }} />
          </View>
        ) : undefined}
      />
    </View>
  );
}

/**
 * One past check, in full.
 *
 * Everything here was already stored - the symptoms and their severities, the
 * band, the score, how sure the engine was, which red flags fired and the
 * reasoning it gave. The list could only ever show one line of it, so the
 * rest was being kept and never shown.
 *
 * Nothing is recomputed. A record is what the engine said at the time, and
 * re-running it now against different rules would quietly rewrite history.
 */
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
