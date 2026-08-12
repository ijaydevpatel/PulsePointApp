/** FR1, FR3, QR5. Red-flag escalation sits above everything else on the screen. */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { TriageResult, BAND_LABEL, BAND_ADVICE, requiresEscalation } from '../../domain/entities';
import { SeveritySpine } from '../components/SeveritySpine';
import { Card, SectionLabel, Button } from '../components/Primitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { BAND, C, S, R, T, TOUCH } from '../theme';

export function ResultScreen({ result, elapsedMs, onBack, onFindCare }: {
  result: TriageResult; elapsedMs: number | null;
  onBack: () => void; onFindCare: () => void;
}) {
  const band = BAND[result.band];
  const escalate = requiresEscalation(result);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }}>
      <ScreenHeader title="Your result" onBack={onBack} />

      <View style={{ paddingHorizontal: S.xl }}>
        {/* Escalation first. QR5: never below the fold, never after the score. */}
        {escalate ? (
          <View style={st.alert}>
            <Text style={st.alertTitle}>
              {result.band === 'EMERGENCY' ? 'Get emergency help now' : 'Get seen today'}
            </Text>
            {result.redFlags.map((f) => (
              <Text key={f} style={st.alertItem}>• {f}</Text>
            ))}
            <Pressable
              accessibilityRole="button" accessibilityLabel="Call 111 emergency services"
              onPress={() => Linking.openURL('tel:111')} style={st.call}>
              <Text style={st.callText}>Call 111</Text>
            </Pressable>
          </View>
        ) : null}

        <Card style={{ marginTop: escalate ? S.lg : 0 }}>
          <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center' }}>
            <SeveritySpine band={result.band} height={68} width={7} />
            <View style={{ flex: 1 }}>
              <Text style={[T.section, { color: band.fg }]}>{band.short.toUpperCase()}</Text>
              <Text style={[T.title, { marginTop: 2 }]}>{BAND_LABEL[result.band]}</Text>
              <Text style={[T.mono, { marginTop: S.sm, color: C.muted }]}>
                {result.severity}/100 · {Math.round(result.confidence * 100)}% confidence
              </Text>
            </View>
          </View>
          <Text style={[T.body, { marginTop: S.lg }]}>{BAND_ADVICE[result.band]}</Text>
        </Card>

        <View style={{ height: S.lg }} />
        <Button title="Find care near me" tone="quiet" onPress={onFindCare} />

        {result.rationale.length > 0 ? (
          <>
            <View style={{ height: S.xxl }} />
            <SectionLabel>WHAT THIS LOOKED AT</SectionLabel>
            <Card>
              {result.rationale.map((r) => (
                <Text key={r} style={[T.body, { fontSize: 15 }]}>• {r}</Text>
              ))}
            </Card>
          </>
        ) : null}

        <View style={{ height: S.xxl }} />
        <Text style={T.caption}>
          Checked on this device{elapsedMs !== null ? ` in ${elapsedMs} ms` : ''} using the
          {result.source === 'ON_DEVICE_MODEL' ? ' on-device model' : ' rules engine'}.
          {result.syncStatus === 'PENDING_SYNC'
            ? ' A fuller explanation will be added when you are back online.' : ''}
        </Text>
        <Text style={[T.caption, { marginTop: S.md, fontStyle: 'italic' }]}>
          This is not a diagnosis and does not replace medical advice. Healthline is free on
          0800 611 116. In an emergency call 111.
        </Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  alert: { backgroundColor: C.dangerSoft, borderRadius: R.lg, padding: S.lg,
    borderLeftWidth: 4, borderLeftColor: C.danger },
  alertTitle: { fontSize: 19, fontWeight: '800', color: '#8E1226' },
  alertItem: { fontSize: 14.5, lineHeight: 21, color: '#8E1226', marginTop: S.xs },
  call: { minHeight: TOUCH + 6, borderRadius: R.md, backgroundColor: C.danger,
    alignItems: 'center', justifyContent: 'center', marginTop: S.lg },
  callText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
