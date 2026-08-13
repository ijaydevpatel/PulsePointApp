/** FR4 — care locator. Phase 6 adds GPS, the cached dataset and the map. */
import React from 'react';
import { View, Animated } from 'react-native';
import { TriageBand } from '../../domain/entities';
import { useTheme, S, TAB_CLEARANCE } from '../theme';
import { Txt } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { SeveritySpine } from '../components/SeveritySpine';
import { ListSection, ListCustomRow } from '../components/List';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';

const SAMPLE: { name: string; kind: string; km: string; band: TriageBand; open: string }[] = [
  { name: 'Auckland City Hospital', kind: 'Emergency department', km: '3.4 km', band: 'EMERGENCY', open: 'Open 24 hours' },
  { name: 'City Urgent Care', kind: 'Urgent care clinic', km: '1.2 km', band: 'URGENT', open: 'Open until 10 pm' },
  { name: 'Queen St Medical', kind: 'General practice', km: '0.6 km', band: 'PHARMACY_GP', open: 'Open until 5 pm' },
  { name: 'Unichem Pharmacy', kind: 'Pharmacy', km: '0.3 km', band: 'SELF_CARE', open: 'Open until 7 pm' },
];

export function CareScreen() {
  const { c: P, band: B } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();

  return (
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: TAB_CLEARANCE + S.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <NavBar title="Care" y={nav.y} />
      <LargeTitle title="Care near you" subtitle="Ranked by the level of care you need" y={nav.y} />

      <ListSection
        header="Nearest first"
        footer="Sample data. Phase 6 adds GPS, a bundled facility dataset and the map. When offline the ranking prefers 24-hour hospitals over clinics, because clinic hours go stale and hospital hours do not."
      >
        {SAMPLE.map((f) => (
          <ListCustomRow key={f.name} onPress={() => {}} minHeight={64}>
            <SeveritySpine band={f.band} height={40} width={4} />
            <View style={{ flex: 1 }}>
              <Txt t="body" c={P.ink}>{f.name}</Txt>
              <Txt t="footnote" c={P.muted} style={{ marginTop: 1 }}>
                {`${f.kind} · ${f.km}`}
              </Txt>
              <Txt t="caption1" c={B[f.band].fg} style={{ marginTop: 2 }}>{f.open}</Txt>
            </View>
            <Icon name="chevronRight" size={16} color={P.faint} />
          </ListCustomRow>
        ))}
      </ListSection>
    </Animated.ScrollView>
  );
}
