/** FR5 — encrypted history, review and delete. Wired to the real store. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, EmptyState, SectionLabel, Button } from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { BAND_LABEL } from '../../domain/entities';
import { C, S, T, TOUCH } from '../theme';

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString();
}

export function RecordsScreen({ store, refreshKey }: { store: EpisodeStore; refreshKey: number }) {
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
      <ScreenHeader title="Records" subtitle="Stored encrypted on this device only" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.episode.id}
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: S.xxxl }}
        ListHeaderComponent={rows.length ? <SectionLabel>PAST CHECKS</SectionLabel> : undefined}
        ListEmptyComponent={loaded ? (
          <EmptyState title="No checks yet"
            body="Symptom checks you run will be saved here, encrypted, so you can look back at them." />
        ) : undefined}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: S.sm }}>
            <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
              <SeveritySpine band={item.result.band} height={40} width={5} />
              <View style={{ flex: 1 }}>
                <Text style={T.bodyStrong}>{BAND_LABEL[item.result.band]}</Text>
                <Text style={[T.caption, { marginTop: 2 }]}>
                  {when(item.episode.capturedAt)} · {item.episode.symptoms.length} symptom
                  {item.episode.symptoms.length === 1 ? '' : 's'} · {item.result.severity}/100
                </Text>
                {item.result.syncStatus === 'PENDING_SYNC' ? (
                  <Text style={[T.caption, { color: C.faint, marginTop: 2 }]}>Not yet enriched</Text>
                ) : null}
              </View>
              <Pressable accessibilityRole="button"
                accessibilityLabel={`Delete check from ${when(item.episode.capturedAt)}`}
                onPress={() => remove(item.episode.id)} style={st.del} hitSlop={6}>
                <View style={st.delBar} />
              </Pressable>
            </View>
          </Card>
        )}
        ListFooterComponent={rows.length > 1 ? (
          <View style={{ marginTop: S.xl }}>
            <Button title="Delete all records" tone="danger" onPress={() => {
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

const st = StyleSheet.create({
  del: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  delBar: { width: 16, height: 2, borderRadius: 2, backgroundColor: C.faint },
});
