import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, StyleSheet, ActivityIndicator, LayoutAnimation,
  Platform, UIManager, Animated, Easing, TextInput,
} from 'react-native';
import { AgeBand, Symptom, SymptomEpisode, TriageResult } from '../../domain/entities';
import { AssessSymptomsUseCase } from '../../domain/assessSymptoms';
import { CATALOGUE } from '../../data/symptomCatalogue';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, Chip, Txt, Springy, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, MOTION, TYPE, circle } from '../theme';
import { useReveal } from '../useReveal';
import { EpisodeStore, Classifier } from '../../domain/ports';
import {
  SymptomAnalysis, SymptomAnalysisService, ProfileService, RemoteOutcome,
} from '../../domain/remote';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function bandForAge(age: number | null): AgeBand {
  if (age === null) return 'ADULT';
  if (age < 12) return 'CHILD';
  if (age >= 65) return 'OLDER_ADULT';
  return 'ADULT';
}
const DURATIONS = [
  { hours: 6, label: 'Today' }, { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' }, { hours: 168, label: 'A week+' },
];

const LEVELS = [
  { v: 1, label: 'Slight' }, { v: 3, label: 'Mild' }, { v: 5, label: 'Moderate' },
  { v: 7, label: 'Strong' }, { v: 9, label: 'Severe' },
];

export function TriageScreen({
  classifier, store, onResult, analysis, profile, onAnalysis, onSaved,
}: {
  classifier: Classifier; store: EpisodeStore;
  onResult: (r: TriageResult, ms: number) => void;

  analysis?: SymptomAnalysisService;

  profile?: ProfileService;

  onAnalysis?: (a: RemoteOutcome<SymptomAnalysis>) => void;

  /** Fired once the record is on disk, complete. */
  onSaved?: (r: TriageResult) => void;
}) {
  const { c: P, elev } = useTheme();
  const [profileAge, setProfileAge] = useState<number | null | undefined>(undefined);
  const [duration, setDuration] = useState(6);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    if (!profile) { setProfileAge(null); return; }
    void profile.me().then((r) => {
      if (alive) setProfileAge(r.status === 'OK' ? r.data?.age ?? null : null);
    });
    return () => { alive = false; };
  }, [profile]);

  const age = bandForAge(profileAge ?? null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const useCase = useMemo(
    () => new AssessSymptomsUseCase(classifier, store), [classifier, store],
  );
  const count = Object.keys(picked).length;

  const canSubmit = count > 0 || note.trim().length > 0;

  const { value: fabIn, animateTo: fadeTo } = useReveal();
  const { value: fabScale, animateTo: popTo } = useReveal(0.6, 1);

  useEffect(() => {
    fadeTo(canSubmit ? 1 : 0, {
      duration: MOTION.fast,
      easing: Easing.out(Easing.quad),
    });
    popTo(canSubmit ? 1 : 0.6, {
      damping: MOTION.spring.damping,
      stiffness: MOTION.spring.stiffness,
      mass: MOTION.spring.mass,
    });
  }, [canSubmit, fadeTo, popTo]);

  const toggle = (code: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setPicked((p) => {
      const n = { ...p };
      if (n[code] === undefined) n[code] = 5; else delete n[code];
      return n;
    });
  };

  async function assess() {
    setBusy(true);
    tap('medium');
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

      // Score first and show it straight away. An escalated band must not wait
      // on the network, so display is unchanged.
      const r = await useCase.assess(episode);
      onResult(r, Date.now() - t0);
      setPicked({});
      setNote('');

      // Nothing is written until the analysis attempt has finished, so a saved
      // record always carries everything it is ever going to carry. The request
      // is bounded by the client timeout, so this cannot hang.
      void (async () => {
        let outcome: RemoteOutcome<SymptomAnalysis> | null = null;
        if (analysis) {
          try {
            outcome = await analysis.analyze({
              activeSymptoms: symptoms.map((s) => s.label),
              customSymptom: note.trim(),
            });
          } catch {
            outcome = null;
          }
        }

        await store.save(episode, r);
        if (outcome?.status === 'OK' && outcome.data) {
          await store.attachAnalysis(episode.id, outcome.data);
        }

        onSaved?.(r);
        if (outcome && onAnalysis) onAnalysis(outcome);
      })();
    } finally { setBusy(false); }
  }

  return (

    <KeyboardSafe extra={TAB_CLEARANCE}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="How are you feeling?" />

        <View style={st.body}>
          <View>
            <SectionLabel>How long</SectionLabel>
            <View style={st.row}>
              {DURATIONS.map((d) => (
                <Chip key={d.hours} label={d.label} selected={duration === d.hours}
                  onPress={() => setDuration(d.hours)} />
              ))}
            </View>
          </View>

          <View>
            <View style={{ height: S.xxl }} />
            <View style={st.symHeadRow}>
              <SectionLabel style={{ marginBottom: 0 }}>Symptoms</SectionLabel>
              {count > 0 ? (
                <View style={[st.counter, { backgroundColor: P.accent }]}>
                  <Txt t="micro" c={P.onAccent}>{`${count} selected`}</Txt>
                </View>
              ) : null}
            </View>
            <View style={{ height: S.md }} />
          </View>

          <View>
            <View style={{ height: S.xxl }} />
            <SectionLabel>Describe it yourself</SectionLabel>
            <TextInput
              style={[st.note, { borderColor: P.line, backgroundColor: P.surface, color: P.ink }]}
              value={note}
              onChangeText={setNote}
              placeholder="Tell us what you're feeling, in your own words"
              placeholderTextColor={P.faint}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Describe your symptoms"
            />
            <View style={{ height: S.xxl }} />
            <SectionLabel>Or pick from the list below</SectionLabel>
          </View>

          {CATALOGUE.map((c) => {
            const on = picked[c.code] !== undefined;
            return (

              <Card
                key={c.code}
                padded={false}
                elevated={on ? 2 : 1}
                style={{
                  marginBottom: S.sm,
                  borderColor: on ? P.accent : 'transparent',
                  borderWidth: on ? 1.5 : 0,
                }}
              >
                <Springy
                  onPress={() => toggle(c.code)}
                  weight="select"
                  scaleTo={0.99}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={c.label}
                  style={st.symHead}
                >
                  <View style={[st.box, {
                    borderColor: on ? P.accent : P.lineStrong,
                    backgroundColor: on ? P.accent : 'transparent',
                  }]}>
                    {on ? <View style={[st.tick, { borderColor: P.onAccent }]} /> : null}
                  </View>
                  <Txt t="bodyStrong" style={{ flex: 1 }}>{c.label}</Txt>
                </Springy>

                {on ? (
                  <View style={st.levels}>
                    {LEVELS.map((l) => {
                      const sel = picked[c.code] === l.v;
                      return (
                        <Springy
                          key={l.v}
                          weight="select"
                          scaleTo={0.92}
                          accessibilityLabel={`${c.label}: ${l.label}`}
                          accessibilityState={{ selected: sel }}
                          onPress={() => setPicked((p) => ({ ...p, [c.code]: l.v }))}
                          style={[st.level, {
                            backgroundColor: sel ? P.ink : P.sunken,
                            borderColor: sel ? P.ink : 'transparent',
                          }]}
                        >
                          <Txt t="micro" c={sel ? P.bg : P.muted}>{l.label}</Txt>
                        </Springy>
                      );
                    })}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <Animated.View
        pointerEvents={canSubmit ? 'box-none' : 'none'}
        style={[
          st.fabWrap,
          { bottom: TAB_CLEARANCE + S.sm, opacity: fabIn, transform: [{ scale: fabScale }] },
        ]}
      >
        {busy ? (
          <View style={[st.fab, { backgroundColor: P.accent }, elev(3)]}>
            <ActivityIndicator color={P.onAccent} />
          </View>
        ) : (
          <Springy
            onPress={assess}
            disabled={!canSubmit}
            weight="medium"
            scaleTo={0.9}
            accessibilityLabel={`Check ${count} selected symptom${count === 1 ? '' : 's'}`}
            style={[st.fab, { backgroundColor: P.accent }, elev(3)]}
          >
            <Icon name="arrowRight" size={26} color={P.onAccent} weight="bold" />
          </Springy>
        )}
      </Animated.View>
    </KeyboardSafe>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: S.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  symHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.pill },
  symHead: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH + 10, paddingHorizontal: S.lg,
  },
  box: {
    width: 23, height: 23, borderRadius: 11.5, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tick: {
    width: 9, height: 5, borderLeftWidth: 2.2, borderBottomWidth: 2.2,
    transform: [{ rotate: '-45deg' }], marginTop: -2,
  },
  levels: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: S.lg, paddingBottom: S.md,
  },
  level: {
    minHeight: 34, paddingHorizontal: S.lg, borderRadius: R.pill,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  note: {
    minHeight: 96, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.md,
    ...TYPE.body,
  },
  fabWrap: { position: 'absolute', right: S.xl },
  fab: { ...circle(60), alignItems: 'center', justifyContent: 'center' },
});
