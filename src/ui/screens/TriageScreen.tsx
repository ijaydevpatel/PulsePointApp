/**
 * The app opens here. No landing page — the first screen is the task (§5.3).
 * FR1, FR2, FR3.
 *
 * Laid out as an iOS grouped form: segmented controls for the two fixed
 * choices, then a checklist section. Age and duration are segmented rather
 * than free chips because both are short, mutually exclusive sets — which is
 * exactly the control's purpose, and it removes 7 tappable targets from the
 * first screen.
 *
 * Severity still appears only after a symptom is selected. Showing five
 * severity buttons against 24 symptoms up front would put 120 controls on
 * screen and read as a form to fill in rather than a question to answer.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, LayoutAnimation,
  Platform, UIManager, Animated, Easing, Pressable,
} from 'react-native';
import { AgeBand, Symptom, SymptomEpisode, TriageResult } from '../../domain/entities';
import { AssessSymptomsUseCase } from '../../domain/assessSymptoms';
import { CATALOGUE } from '../../data/symptomCatalogue';
import { Txt, Springy, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ListSection, ListCustomRow } from '../components/List';
import { Segmented } from '../components/Controls';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, MOTION, circle, ROW_INSET } from '../theme';
import { EpisodeStore, Classifier } from '../../domain/ports';

// Only needed on the old architecture; the setter does not exist under Fabric,
// where layout animations are enabled by default. Guarded rather than assumed.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AGES: readonly { value: AgeBand; label: string }[] = [
  { value: 'CHILD', label: 'Under 12' },
  { value: 'ADULT', label: '12–64' },
  { value: 'OLDER_ADULT', label: '65+' },
];
const DURATIONS: readonly { value: number; label: string }[] = [
  { value: 6, label: 'Today' },
  { value: 24, label: '1 day' },
  { value: 72, label: '3 days' },
  { value: 168, label: 'A week+' },
];
/*
 * Ordered least to most severe.
 *
 * The previous labels ran Mild → Slight → Moderate, which is backwards in
 * ordinary English: "slight" is milder than "mild". Anyone reading the control
 * left to right would have mapped their symptom to the wrong value, and that
 * value feeds the severity score directly. The underlying 1..9 scale is
 * unchanged, so classifier calibration is unaffected.
 */
const LEVELS = [
  { v: 1, label: 'Slight' }, { v: 3, label: 'Mild' }, { v: 5, label: 'Moderate' },
  { v: 7, label: 'Strong' }, { v: 9, label: 'Severe' },
];

export function TriageScreen({ classifier, store, onResult }: {
  classifier: Classifier; store: EpisodeStore;
  onResult: (r: TriageResult, ms: number) => void;
}) {
  const { c: P, elev } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();

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
      const r = await useCase.execute(episode);
      onResult(r, Date.now() - t0);
      setPicked({});
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <NavBar title="Symptoms" y={nav.y} />

      <Animated.ScrollView
        onScroll={nav.onScroll}
        scrollEventThrottle={nav.scrollEventThrottle}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LargeTitle
          title="How are you feeling?"
          subtitle="Checked on your device. Nothing is sent."
          y={nav.y}
        />

        <ListSection header="Age">
          <ListCustomRow>
            <Segmented options={AGES} value={age} onChange={setAge} style={{ flex: 1 }} />
          </ListCustomRow>
        </ListSection>

        <ListSection header="How long">
          <ListCustomRow>
            <Segmented options={DURATIONS} value={duration} onChange={setDuration} style={{ flex: 1 }} />
          </ListCustomRow>
        </ListSection>

        <ListSection
          header={count > 0 ? `Symptoms · ${count} selected` : 'Symptoms'}
          footer="Tap a symptom to add it, then choose how strong it feels."
        >
          {CATALOGUE.map((c) => {
            const on = picked[c.code] !== undefined;
            return (
              <View key={c.code}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={c.label}
                  onPress={() => toggle(c.code)}
                  onPressIn={() => tap('select')}
                  style={({ pressed }) => [
                    rowStyle.row,
                    { backgroundColor: pressed ? P.sunken : 'transparent' },
                  ]}
                >
                  <Txt t="body" style={{ flex: 1 }} c={P.ink}>{c.label}</Txt>
                  {on ? (
                    <Icon name="check" size={19} color={P.accent} weight="bold" />
                  ) : null}
                </Pressable>

                {on ? (
                  <View style={rowStyle.levels}>
                    <Segmented
                      compact
                      options={LEVELS.map((l) => ({ value: l.v, label: l.label }))}
                      value={picked[c.code]!}
                      onChange={(v) => setPicked((p) => ({ ...p, [c.code]: v }))}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ListSection>
      </Animated.ScrollView>

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

const rowStyle = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH, paddingHorizontal: ROW_INSET, paddingVertical: 10,
  },
  levels: { paddingHorizontal: ROW_INSET, paddingBottom: 10, flexDirection: 'row' },
});

const st = StyleSheet.create({
  fabWrap: { position: 'absolute', right: S.xl },
  fab: { ...circle(60), alignItems: 'center', justifyContent: 'center' },
});
