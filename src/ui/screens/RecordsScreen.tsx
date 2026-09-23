/** FR5 — encrypted history, review and delete. Wired to the real store. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Card, EmptyState, SectionLabel, Button, Txt, Springy, Enter,
} from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { Icon } from '../components/Icon';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { BAND_LABEL } from '../../domain/entities';
import { useTheme, S, TOUCH, TAB_CLEARANCE } from '../theme';

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
   *  from a tab — a pushed screen needs a way back. */
  onBack?: () => void;
}) {
  const { c: P, band: B } = useTheme();
  const [rows, setRows] = useState<readonly HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

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
            <Card style={{ marginBottom: S.sm }}>
              <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
                <SeveritySpine band={item.result.band} height={42} width={5} />
                <View style={{ flex: 1 }}>
                  <Txt t="bodyStrong" c={B[item.result.band].fg}>
                    {BAND_LABEL[item.result.band]}
                  </Txt>
                  <Txt t="caption" style={{ marginTop: 3 }}>
                    {`${when(item.episode.capturedAt)} · ${item.episode.symptoms.length} symptom${
                      item.episode.symptoms.length === 1 ? '' : 's'} · ${item.result.severity}/100`}
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
