/** FR4 — care locator. Phase 6 adds GPS, the cached dataset and the map. */
import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, PhaseNotice } from '../components/Primitives';
import { SeveritySpine } from '../components/SeveritySpine';
import { S, T, C } from '../theme';
import { TriageBand } from '../../domain/entities';

const SAMPLE: { name: string; kind: string; km: string; band: TriageBand; open: string }[] = [
  { name: 'Auckland City Hospital', kind: 'Emergency department', km: '3.4 km', band: 'EMERGENCY', open: 'Open 24 hours' },
  { name: 'City Urgent Care', kind: 'Urgent care clinic', km: '1.2 km', band: 'URGENT', open: 'Open until 10 pm' },
  { name: 'Queen St Medical', kind: 'General practice', km: '0.6 km', band: 'PHARMACY_GP', open: 'Open until 5 pm' },
  { name: 'Unichem Pharmacy', kind: 'Pharmacy', km: '0.3 km', band: 'SELF_CARE', open: 'Open until 7 pm' },
];

export function CareScreen() {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }}>
      <ScreenHeader title="Care near you" subtitle="Ranked by the level of care you need" />
      <View style={{ paddingHorizontal: S.xl }}>
        <SectionLabel>NEAREST FIRST</SectionLabel>
        {SAMPLE.map((f) => (
          <Card key={f.name} style={{ marginBottom: S.sm }}>
            <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
              <SeveritySpine band={f.band} height={44} width={5} />
              <View style={{ flex: 1 }}>
                <Text style={T.bodyStrong}>{f.name}</Text>
                <Text style={[T.caption, { marginTop: 2 }]}>{f.kind} · {f.km}</Text>
                <Text style={[T.caption, { color: C.ok, fontWeight: '600', marginTop: 2 }]}>{f.open}</Text>
              </View>
            </View>
          </Card>
        ))}
        <View style={{ height: S.lg }} />
        <PhaseNotice phase={6}
          what="Sample data. Phase 6 adds GPS, a bundled facility dataset and the map. When offline the ranking prefers 24-hour hospitals over clinics, because clinic hours go stale and hospital hours do not." />
      </View>
    </ScrollView>
  );
}
