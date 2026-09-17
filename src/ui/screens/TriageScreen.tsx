/**
 * The app opens here. No landing page — the first screen is the task (§5.3).
 * FR1, FR2, FR3.
 *
 * Severity only appears once a symptom is selected. Showing five severity
 * buttons against 24 symptoms up front would put 120 controls on screen and
 * read as a form to fill in rather than a question to answer. Progressive
 * disclosure keeps the first impression to one decision, which is what PACMAD's
 * cognitive-load attribute asks for.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, StyleSheet, ActivityIndicator, LayoutAnimation,
  Platform, UIManager, Animated, Easing,
} from 'react-native';
import { AgeBand, Symptom, SymptomEpisode, TriageResult } from '../../domain/entities';
import { AssessSymptomsUseCase } from '../../domain/assessSymptoms';
import { CATALOGUE } from '../../data/symptomCatalogue';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, Chip, Txt, Springy, Enter, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, MOTION, circle } from '../theme';
import { EpisodeStore, Classifier } from '../../domain/ports';
import {
  SymptomAnalysis, SymptomAnalysisService, RemoteOutcome,
} from '../../domain/remote';

// Only needed on the old architecture; the setter does not exist under Fabric,
// where layout animations are enabled by default. Guarded rather than assumed.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AGES: { key: AgeBand; label: string }[] = [
  { key: 'CHILD', label: 'Under 12' },
  { key: 'ADULT', label: '12–64' },
  { key: 'OLDER_ADULT', label: '65+' },
];
const DURATIONS = [
  { hours: 6, label: 'Today' }, { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' }, { hours: 168, label: 'A week+' },
];

/*
 * Ordered least to most severe. An earlier version ran Mild → Slight →
 * Moderate, which is backwards in ordinary English: "slight" is milder than
 * "mild". Anyone reading left to right would have mapped their symptom to the
 * wrong value, and that value feeds the severity score directly.
 */
const LEVELS = [
  { v: 1, label: 'Slight' }, { v: 3, label: 'Mild' }, { v: 5, label: 'Moderate' },
  { v: 7, label: 'Strong' }, { v: 9, label: 'Severe' },
];

export function TriageScreen({ classifier, store, onResult, analysis, onAnalysis }: {
  classifier: Classifier; store: EpisodeStore;
  onResult: (r: TriageResult, ms: number) => void;
  /**
   * The hosted diagnostic engine. Optional so the screen still works — and the
   * tests still run — with nothing behind it.
   */
  analysis?: SymptomAnalysisService;
  /** Delivers the hosted matrix once it lands, so Result can render it. */
  onAnalysis?: (a: RemoteOutcome<SymptomAnalysis>) => void;
}) {
  const { c: P, elev } = useTheme();
  const [age, setAge] = useState<AgeBand>('ADULT');
  const [duration, setDuration] = useState(6);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const useCase = useMemo(
    () => new AssessSymptomsUseCase(classifier, store), [classifier, store],
  );
  const count = Object.keys(picked).length;

  /*
   * The action is revealed by the first selection rather than sitting there
   * disabled, so at rest nothing overlaps the list.
   */
  const fabIn = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fabIn, {
        toValue: count > 0 ? 1 : 0,
        duration: MOTION.fast,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(fabScale, {
        toValue: count > 0 ? 1 : 0.6,
        damping: MOTION.spring.damping,
        stiffness: MOTION.spring.stiffness,
        mass: MOTION.spring.mass,
        useNativeDriver: true,
      }),
    ]).start();
  }, [count, fabIn, fabScale]);

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

      // Local first, always. The band is decided on the device so a slow or
      // failed network call delays the wording, never the triage — and the
      // person gets an answer at the speed of the phone rather than the
      // speed of the model.
      const r = await useCase.execute(episode);
      onResult(r, Date.now() - t0);
      setPicked({});

      // Then the hosted matrix, which enriches the result screen. Deliberately
      // not awaited before onResult: making the user watch a spinner for a
      // remote call they may not need is the behaviour being designed out.
      if (analysis && onAnalysis) {
        void analysis
          .analyze({
            activeSymptoms: symptoms.map((s) => s.label),
            customSymptom: '',
          })
          .then(onAnalysis);
      }
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="How are you feeling?"
          subtitle="Checked on your device. Nothing is sent."
        />

        <View style={st.body}>
          <Enter index={1}>
            <SectionLabel>Age</SectionLabel>
            <View style={st.row}>
              {AGES.map((a) => (
                <Chip key={a.key} label={a.label} selected={age === a.key}
                  onPress={() => setAge(a.key)} />
              ))}
            </View>
          </Enter>

          <Enter index={2}>
            <View style={{ height: S.xxl }} />
            <SectionLabel>How long</SectionLabel>
            <View style={st.row}>
              {DURATIONS.map((d) => (
                <Chip key={d.hours} label={d.label} selected={duration === d.hours}
                  onPress={() => setDuration(d.hours)} />
              ))}
            </View>
          </Enter>

          <Enter index={3}>
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
          </Enter>

          {CATALOGUE.map((c, i) => {
            const on = picked[c.code] !== undefined;
            return (
              <Enter key={c.code} index={Math.min(4 + i, 9)}>
                <Card
                  padded={false}
                  elevated={on ? 2 : 1}
                  glass={true}
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
              </Enter>
            );
          })}
        </View>
      </ScrollView>

      {/*
        Compact action, not a full-width bar. A stretched button pinned above
        the tab bar covered a whole symptom row and left the list permanently
        obstructed — you could not see the item you had just tapped.
      */}
      <Animated.View
        pointerEvents={count === 0 ? 'none' : 'box-none'}
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
            disabled={count === 0}
            weight="medium"
            scaleTo={0.9}
            accessibilityLabel={`Check ${count} selected symptom${count === 1 ? '' : 's'}`}
            style={[st.fab, { backgroundColor: P.accent }, elev(3)]}
          >
            <Icon name="arrowRight" size={26} color={P.onAccent} weight="bold" />
          </Springy>
        )}
      </Animated.View>
    </View>
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
  fabWrap: { position: 'absolute', right: S.xl },
  fab: { ...circle(60), alignItems: 'center', justifyContent: 'center' },
});
