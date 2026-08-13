/** FR5 — encrypted history, review and delete. Wired to the real store. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Alert, Animated, Pressable } from 'react-native';
import { EpisodeStore, HistoryEntry } from '../../domain/ports';
import { BAND_LABEL } from '../../domain/entities';
import { useTheme, S, TAB_CLEARANCE, circle } from '../theme';
import { Txt, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { SeveritySpine } from '../components/SeveritySpine';
import { ListSection, ListRow, ListCustomRow } from '../components/List';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString();
}

export function RecordsScreen({ store, refreshKey }: { store: EpisodeStore; refreshKey: number }) {
  const { c: P, band: B } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();
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
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: TAB_CLEARANCE + S.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <NavBar title="Records" y={nav.y} />
      <LargeTitle title="Records" subtitle="Stored encrypted on this device only" y={nav.y} />

      {rows.length === 0 && loaded ? (
        <View style={{ alignItems: 'center', paddingTop: S.huge, paddingHorizontal: S.xxl }}>
          <View style={[circle(72), { backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="clock" size={30} color={P.faint} />
          </View>
          <Txt t="title3" c={P.ink} center style={{ marginTop: S.lg }}>No checks yet</Txt>
          <Txt t="subhead" c={P.muted} center style={{ marginTop: S.sm }}>
            Symptom checks you run will be saved here, encrypted, so you can look back at them.
          </Txt>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <ListSection header="Past checks">
          {rows.map((item) => (
            <ListCustomRow key={item.episode.id} minHeight={62}>
              <SeveritySpine band={item.result.band} height={38} width={4} />
              <View style={{ flex: 1 }}>
                <Txt t="body" c={B[item.result.band].fg}>{BAND_LABEL[item.result.band]}</Txt>
                <Txt t="footnote" c={P.muted} style={{ marginTop: 1 }}>
                  {`${when(item.episode.capturedAt)} · ${item.episode.symptoms.length} symptom${
                    item.episode.symptoms.length === 1 ? '' : 's'} · ${item.result.severity}/100`}
                </Txt>
              </View>
              <Pressable
                onPress={() => remove(item.episode.id)}
                onPressIn={() => tap('warn')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Delete check from ${when(item.episode.capturedAt)}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
              >
                <Icon name="trash" size={18} color={P.danger} />
              </Pressable>
            </ListCustomRow>
          ))}
        </ListSection>
      ) : null}

      {rows.length > 0 ? (
        <ListSection>
          <ListRow
            title="Delete all records"
            destructive
            accessory="none"
            onPress={() => {
              Alert.alert('Delete everything?', 'All saved checks will be removed from this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive',
                  onPress: async () => { await store.clear(); await load(); } },
              ]);
            }}
          />
        </ListSection>
      ) : null}
    </Animated.ScrollView>
  );
}
