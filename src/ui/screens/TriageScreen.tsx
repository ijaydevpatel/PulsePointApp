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
  Platform, UIManager, Animated, Easing, TextInput,
} from 'react-native';
import { AgeBand, Symptom, SymptomEpisode, TriageResult } from '../../domain/entities';
import { AssessSymptomsUseCase } from '../../domain/assessSymptoms';
import { CATALOGUE } from '../../data/symptomCatalogue';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, Chip, Txt, Springy, Enter, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, MOTION, TYPE, circle } from '../theme';
import { EpisodeStore, Classifier } from '../../domain/ports';
import {
  SymptomAnalysis, SymptomAnalysisService, ProfileService, RemoteOutcome,
} from '../../domain/remote';

// Only needed on the old architecture; the setter does not exist under Fabric,
// where layout animations are enabled by default. Guarded rather than assumed.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Age band from the account's recorded age.
 *
 * The screen used to ask this every time. It is a fact about the person, not
 * about this episode, so re-asking was friction and a chance to get it wrong —
 * and it drives real red-flag rules, where a fever at 70 is not a fever at 30.
 *
 * ADULT is the fallback when the profile has no age. That is a deliberate
 * choice and not a neutral one: it means the two age-specific rules cannot
 * fire, so the checker under-triages a child or an older adult whose profile
 * is blank. The alternative — guessing an age — would be worse, because a
 * wrong band fires the wrong rules rather than none. The banner below says so
 * on screen rather than leaving it silent.
 */
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

export function TriageScreen({ classifier, store, onResult, analysis, profile, onAnalysis }: {
  classifier: Classifier; store: EpisodeStore;
  onResult: (r: TriageResult, ms: number) => void;
  /**
   * The hosted diagnostic engine. Optional so the screen still works — and the
   * tests still run — with nothing behind it.
   */
  analysis?: SymptomAnalysisService;
  /** Supplies the recorded age, so the screen no longer has to ask for it. */
  profile?: ProfileService;
  /** Delivers the hosted matrix once it lands, so Result can render it. */
  onAnalysis?: (a: RemoteOutcome<SymptomAnalysis>) => void;
}) {
  const { c: P, elev } = useTheme();
  const [profileAge, setProfileAge] = useState<number | null | undefined>(undefined);
  const [duration, setDuration] = useState(6);
  const [note, setNote] = useState('');

  // undefined while loading, null when the profile has no age on file.
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
  // Either input is enough on its own.
  const canSubmit = count > 0 || note.trim().length > 0;

  /*
   * The action is revealed by the first selection rather than sitting there
   * disabled, so at rest nothing overlaps the list.
   */
  const fabIn = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fabIn, {
        toValue: canSubmit ? 1 : 0,
        duration: MOTION.fast,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(fabScale, {
        toValue: canSubmit ? 1 : 0.6,
        damping: MOTION.spring.damping,
        stiffness: MOTION.spring.stiffness,
        mass: MOTION.spring.mass,
        useNativeDriver: true,
      }),
    ]).start();
  }, [canSubmit, fabIn, fabScale]);

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
      setNote('');

      // Then the hosted matrix, which enriches the result screen. Deliberately
      // not awaited before onResult: making the user watch a spinner for a
      // remote call they may not need is the behaviour being designed out.
      if (analysis && onAnalysis) {
        void analysis
          .analyze({
            activeSymptoms: symptoms.map((s) => s.label),
            customSymptom: note.trim(),
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
        <ScreenHeader title="How are you feeling?" />

        <View style={st.body}>
          <Enter index={2}>
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

          {/*
            Deliberately not wrapped in Enter.
            This block re-renders on every keystroke, and an entrance
            animation around a focused text input is one more thing that can
            interfere with the field while someone is typing in it. The list
            below still animates in; the box someone is using does not.
          */}
          <View>
            <View style={{ height: S.xxl }} />
            <SectionLabel>Describe it yourself</SectionLabel>
            {/*
              Either/or, not both-required. Some things have no chip — a taste
              that has gone, a pain that only comes at night — and a list can
              never be long enough to cover them. This box takes them in the
              person's own words and goes to the model alongside whatever was
              ticked, so the check works with a selection, with a description,
              or with both.
            */}
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
  note: {
    minHeight: 96, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.md,
    ...TYPE.body,
  },
  fabWrap: { position: 'absolute', right: S.xl },
  fab: { ...circle(60), alignItems: 'center', justifyContent: 'center' },
});
