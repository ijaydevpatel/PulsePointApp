/**
 * Health News — GET /api/news.
 *
 * The backend aggregates RSS feeds, derives a one-line briefing from the top
 * item, and returns each brief with a title, snippet, source, date and
 * category. This renders that list and nothing more.
 *
 * Pull-to-refresh rather than a refresh button: the feed is the whole screen,
 * so the gesture that already means "get me the latest" is the right control.
 * A failed refresh keeps whatever is already on screen and shows the notice
 * above it — throwing away readable articles because a later fetch failed
 * would be a strictly worse outcome than doing nothing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Linking, ActivityIndicator } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt, Springy, Card, EmptyState, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TAB_CLEARANCE } from '../theme';
import { NewsService, NewsItem, NewsFeed } from '../../domain/remote';

export function NewsScreen({ service, onBack }: { service: NewsService; onBack?: () => void }) {
  const { c: P } = useTheme();

  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const r = await service.feed();
    if (r.status === 'OK' && r.data) {
      setFeed(r.data);
      setNotice(null);
    } else {
      // Keep any feed we already have. Only the notice changes.
      setNotice(r.notice);
    }
    setRefreshing(false);
    setLoading(false);
  }, [service]);

  useEffect(() => { void load(false); }, [load]);

  const open = useCallback((item: NewsItem) => {
    if (!item.link) return;
    tap('light');
    void Linking.openURL(item.link).catch(() => {
      setNotice('That article could not be opened.');
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Health News" subtitle="Aggregated clinical briefs" onBack={onBack} />

      <ScrollView
        contentContainerStyle={st.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={P.muted}
          />
        }
      >
        {notice ? (
          <View style={[st.notice, { backgroundColor: P.dangerSoft, borderColor: P.danger + '40' }]}>
            <Icon name="alert" size={16} color={P.danger} />
            <Txt t="caption" c={P.danger} style={{ flex: 1 }}>{notice}</Txt>
          </View>
        ) : null}

        {feed?.briefing ? (
          <Card style={st.briefing}>
            <Txt t="micro" c={P.accent} style={st.eyebrow}>TODAY</Txt>
            <Txt t="bodyStrong" style={{ marginTop: 4 }}>{feed.briefing}</Txt>
          </Card>
        ) : null}

        {loading && !feed ? (
          <View style={st.centre}><ActivityIndicator color={P.accent} /></View>
        ) : null}

        {!loading && !feed ? (
          <EmptyState
            icon="newspaper"
            title="No briefs yet"
            body={notice ?? 'Pull down to try again.'}
          />
        ) : null}

        {feed?.news.map((item) => (
          <Springy key={item.id} onPress={() => open(item)} scaleTo={0.985}>
            <Card style={st.card}>
              <View style={st.metaRow}>
                {item.category ? (
                  <View style={[st.tag, { backgroundColor: P.accentSoft }]}>
                    <Txt t="micro" c={P.accent}>{item.category.toUpperCase()}</Txt>
                  </View>
                ) : null}
                {item.source ? <Txt t="micro" c={P.faint} numberOfLines={1}>{item.source}</Txt> : null}
              </View>

              <Txt t="heading" style={{ marginTop: 6 }} numberOfLines={3}>{item.title}</Txt>

              {item.snippet ? (
                <Txt t="caption" style={{ marginTop: 4 }} numberOfLines={3}>{item.snippet}</Txt>
              ) : null}

              <View style={st.footRow}>
                {item.date ? <Txt t="micro" c={P.faint}>{item.date}</Txt> : <View />}
                {item.link ? (
                  <View style={st.readRow}>
                    <Txt t="micro" c={P.accent}>Read</Txt>
                    <Icon name="chevronRight" size={13} color={P.accent} />
                  </View>
                ) : null}
              </View>
            </Card>
          </Springy>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  list: { padding: S.md, paddingBottom: TAB_CLEARANCE, gap: S.sm },
  centre: { paddingVertical: S.xl, alignItems: 'center' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    padding: S.md, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth,
  },
  briefing: { padding: S.md },
  eyebrow: { letterSpacing: 1.6 },
  card: { padding: S.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  tag: { paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.xs },
  footRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: S.sm,
  },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
