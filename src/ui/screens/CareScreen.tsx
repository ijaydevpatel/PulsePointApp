/** FR4 — care locator. Phase 6 adds GPS, the cached dataset and the map. */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, PhaseNotice, Txt, Enter } from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { Icon } from '../components/Icon';
import { useTheme, S, TAB_CLEARANCE } from '../theme';
import { TriageBand } from '../../domain/entities';

const SAMPLE: { name: string; kind: string; km: string; band: TriageBand; open: string }[] = [
  { name: 'Auckland City Hospital', kind: 'Emergency department', km: '3.4 km', band: 'EMERGENCY', open: 'Open 24 hours' },
  { name: 'City Urgent Care', kind: 'Urgent care clinic', km: '1.2 km', band: 'URGENT', open: 'Open until 10 pm' },
  { name: 'Queen St Medical', kind: 'General practice', km: '0.6 km', band: 'PHARMACY_GP', open: 'Open until 5 pm' },
  { name: 'Unichem Pharmacy', kind: 'Pharmacy', km: '0.3 km', band: 'SELF_CARE', open: 'Open until 7 pm' },
];

export function CareScreen() {
  const { c: P, band: B } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Care near you" subtitle="Ranked by the level of care you need" />
      <View style={{ paddingHorizontal: S.xl }}>
        <SectionLabel>Nearest first</SectionLabel>
        {SAMPLE.map((f, i) => (
          <Enter key={f.name} index={i}>
            <Card style={{ marginBottom: S.sm }} onPress={() => {}}>
              <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
                <SeveritySpine band={f.band} height={46} width={5} />
                <View style={{ flex: 1 }}>
                  <Txt t="bodyStrong">{f.name}</Txt>
                  <Txt t="caption" style={{ marginTop: 3 }}>{`${f.kind} · ${f.km}`}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.ok }} />
                    <Txt t="micro" c={P.ok}>{f.open}</Txt>
                  </View>
                </View>
                <View style={{
                  paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: B[f.band].bg,
                }}>
                  <Txt t="micro" c={B[f.band].fg}>{B[f.band].short}</Txt>
                </View>
                <Icon name="chevronRight" size={17} color={P.faint} />
              </View>
            </Card>
          </Enter>
        ))}
        <View style={{ height: S.lg }} />
        <PhaseNotice
          phase={6}
          what="Sample data. Phase 6 adds GPS, a bundled facility dataset and the map. When offline the ranking prefers 24-hour hospitals over clinics, because clinic hours go stale and hospital hours do not."
        />
      </View>
    </ScrollView>
  );
}
