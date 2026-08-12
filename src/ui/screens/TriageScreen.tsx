/**
 * The app opens here. No landing page — the first screen is the task (§5.3).
 * FR1, FR2, FR3.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { AgeBand, Symptom, SymptomEpisode, TriageResult } from '../../domain/entities';
import { AssessSymptomsUseCase } from '../../domain/assessSymptoms';
import { CATALOGUE } from '../../data/symptomCatalogue';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, SectionLabel } from '../components/Primitives';
import { C, S, R, T, TOUCH } from '../theme';
import { EpisodeStore } from '../../domain/ports';
import { Classifier } from '../../domain/ports';

const AGES: { key: AgeBand; label: string }[] = [
  { key: 'CHILD', label: 'Under 12' },
  { key: 'ADULT', label: '12–64' },
  { key: 'OLDER_ADULT', label: '65+' },
];
const DURATIONS = [
  { hours: 6, label: 'Today' }, { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' }, { hours: 168, label: 'A week+' },
];
const LEVELS = [
  { v: 1, label: 'Mild' }, { v: 3, label: 'Slight' }, { v: 5, label: 'Moderate' },
  { v: 7, label: 'Strong' }, { v: 9, label: 'Severe' },
];

export function TriageScreen({ classifier, store, onResult }: {
  classifier: Classifier; store: EpisodeStore;
  onResult: (r: TriageResult, ms: number) => void;
}) {
  const [age, setAge] = useState<AgeBand>('ADULT');
  const [duration, setDuration] = useState(6);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const useCase = useMemo(
    () => new AssessSymptomsUseCase(classifier, store), [classifier, store],
  );
  const count = Object.keys(picked).length;

  const toggle = (code: string) => setPicked((p) => {
    const n = { ...p };
    if (n[code] === undefined) n[code] = 5; else delete n[code];
    return n;
  });

  async function assess() {
    setBusy(true);
    try {
      const symptoms: Symptom[] = Object.entries(picked).map(([code, severity]) => ({
        code, severity,
        label: CATALOGUE.find((c) => c.code === code)?.label ?? code,
      }));
      const episode: SymptomEpisode = {
        id: `ep_${Date.now()}`, capturedAt: new Date().toISOString(),
        ageBand: age, durationHours: duration, symptoms,
      };
      const t0 = Date.now();
      const r = await useCase.execute(episode);
      onResult(r, Date.now() - t0);
      setPicked({});
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="How are you feeling?" subtitle="Checked on your device. Nothing is sent." />

        <View style={st.body}>
          <SectionLabel>AGE</SectionLabel>
          <View style={st.row}>
            {AGES.map((a) => (
              <Chip key={a.key} label={a.label} on={age === a.key} onPress={() => setAge(a.key)} />
            ))}
          </View>

          <View style={{ height: S.xl }} />
          <SectionLabel>HOW LONG</SectionLabel>
          <View style={st.row}>
            {DURATIONS.map((d) => (
              <Chip key={d.hours} label={d.label} on={duration === d.hours}
                onPress={() => setDuration(d.hours)} />
            ))}
          </View>

          <View style={{ height: S.xl }} />
          <SectionLabel>{count > 0 ? `SYMPTOMS · ${count} SELECTED` : 'SYMPTOMS'}</SectionLabel>
          {CATALOGUE.map((c) => {
            const on = picked[c.code] !== undefined;
            return (
              <Card key={c.code} style={{ padding: 0, marginBottom: S.sm,
                borderColor: on ? C.accent : C.line }}>
                <Pressable
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={c.label} onPress={() => toggle(c.code)} style={st.symHead}>
                  <View style={[st.box, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
                    {on ? <View style={st.tick} /> : null}
                  </View>
                  <Text style={[T.bodyStrong, { flex: 1 }]}>{c.label}</Text>
                </Pressable>
                {on ? (
                  <View style={st.levels}>
                    {LEVELS.map((l) => {
                      const sel = picked[c.code] === l.v;
                      return (
                        <Pressable
                          key={l.v}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.label}: ${l.label}`}
                          accessibilityState={{ selected: sel }}
                          onPress={() => setPicked((p) => ({ ...p, [c.code]: l.v }))}
                          style={[st.level, sel && { backgroundColor: C.ink, borderColor: C.ink }]}
                        >
                          <Text style={[st.levelText, sel && { color: '#fff' }]}>{l.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={st.footer}>
        {busy
          ? <View style={st.busy}><ActivityIndicator color={C.accent} /></View>
          : <Button title={count === 0 ? 'Select a symptom' : 'Check my symptoms'}
              onPress={assess} disabled={count === 0} />}
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[st.chip, on && { backgroundColor: C.accentSoft, borderColor: C.accent }]}>
      <Text style={[st.chipText, on && { color: C.accent, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: S.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    minHeight: TOUCH, paddingHorizontal: S.lg, borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '600', color: C.inkSoft },
  symHead: { flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH + 8, paddingHorizontal: S.lg },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.8, borderColor: C.lineStrong,
    alignItems: 'center', justifyContent: 'center' },
  tick: { width: 9, height: 5, borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: '#fff', transform: [{ rotate: '-45deg' }], marginTop: -2 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: S.lg, paddingBottom: S.md },
  level: { minHeight: 36, paddingHorizontal: S.md, borderRadius: R.sm,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontSize: 13, fontWeight: '600', color: C.muted },
  footer: { padding: S.lg, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  busy: { minHeight: TOUCH + 6, alignItems: 'center', justifyContent: 'center' },
});
