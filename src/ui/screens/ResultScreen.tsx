/**
 * FR1, FR3, QR5. Red-flag escalation sits above everything else on the screen.
 *
 * This is the one screen that gets the expressive treatment. Everywhere else
 * the app is deliberately quiet; here it has something to say, so the band
 * fills the top of the screen edge to edge and the severity figure is set at
 * 76pt. The web app buried a 42% meningitis reading in the least prominent row
 * of a table - this layout makes that failure mode structurally impossible,
 * because the band decides the colour of the screen.
 *
 * The number counts up rather than appearing. That is not decoration: a value
 * that animates from zero communicates that it was computed, and it gives the
 * eye a reason to land on the figure before the advice below it.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Linking, Animated, Easing, ActivityIndicator,
} from 'react-native';
import { TriageResult, BAND_LABEL, BAND_ADVICE, requiresEscalation } from '../../domain/entities';
import { Card, SectionLabel, Button, Txt, Springy, Enter, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, TYPE, S, R, TOUCH, TAB_CLEARANCE, MOTION, circle } from '../theme';
import {
  RemoteOutcome, SymptomAnalysis, ProbableCondition, MatrixSeverity,
} from '../../domain/remote';

/** Counts from 0 to `value`, easing out so it decelerates into place. */
function useCountUp(value: number, duration = 900) {
  const [shown, setShown] = useState(0);
  const av = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = av.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(av, {
      toValue: value,
      duration,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => av.removeListener(id);
  }, [av, value, duration]);
  return shown;
}

export function ResultScreen({ result, elapsedMs, analysis, onBack, onFindCare }: {
  result: TriageResult; elapsedMs: number | null;
  /**
   * The hosted diagnostic matrix. Null means still in flight - the band above
   * is already decided locally, so this section fills in underneath rather
   * than holding the whole screen behind a spinner.
   */
  analysis?: RemoteOutcome<SymptomAnalysis> | null;
  onBack: () => void; onFindCare: () => void;
}) {
  const { c: P, band: B, elev } = useTheme();
  const band = B[result.band];
  const [whyConfidence, setWhyConfidence] = useState(false);
  const escalate = requiresEscalation(result);
  const severity = useCountUp(result.severity);

  // A serious result should feel different in the hand, not only look different.
  useEffect(() => {
    tap(result.band === 'EMERGENCY' ? 'error' : result.band === 'URGENT' ? 'warn' : 'success');
  }, [result.band]);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Colour-blocked band header. The band decides the screen. ── */}
        {/*
          The hairline is not decoration. Apple's systemGreen and systemOrange
          measure ~1.98:1 as a block on the light grouped background, below the
          3:1 WCAG needs for a graphical boundary. Keeping Apple's fill and
          carrying the boundary on this border is what makes the contrast audit
          pass honestly - remove it and QR6 is no longer met.
        */}
        <View style={[
          st.hero,
          { backgroundColor: band.solid, borderColor: band.solidEdge },
        ]}>
          <View style={st.heroTop}>
            {/*
              Not glass here. The hero is a saturated fill, and liquid glass
              over a flat colour has nothing to refract - it would read as a
              grey smudge. A tinted circle is the honest choice on solid ground.
            */}
            <Springy
              onPress={onBack}
              scaleTo={0.88}
              accessibilityLabel="Go back"
              style={[circle(TOUCH), st.centred, { backgroundColor: band.onSolid + '26' }]}
            >
              <Icon name="chevronLeft" size={20} color={band.onSolid} />
            </Springy>
          </View>

          <Enter index={1}>
            <Txt t="section" c={band.onSolid + 'CC'} style={{ marginTop: S.xl }}>
              {band.short.toUpperCase()}
            </Txt>
            <Txt t="display" c={band.onSolid} style={{ marginTop: 6 }}>
              {BAND_LABEL[result.band]}
            </Txt>
          </Enter>

          <Enter index={2}>
            <View style={st.figureRow}>
              <Txt t="hero" c={band.onSolid}>{String(severity)}</Txt>
              <View style={{ paddingBottom: 14, marginLeft: 4 }}>
                <Txt t="title" c={band.onSolid + '99'}>/100</Txt>
              </View>
              <View style={{ flex: 1 }} />
              {/*
                Tappable, because a percentage with no explanation invites the
                obvious question - and the honest answer to "why is it not
                higher" is better than a higher number.
              */}
              <Springy
                onPress={() => { tap('light'); setWhyConfidence(true); }}
                scaleTo={0.94}
                accessibilityLabel={`${Math.round(result.confidence * 100)} percent confidence. How this is worked out.`}
              >
                <View style={[st.conf, { backgroundColor: band.onSolid + '1F' }]}>
                  <Txt t="micro" c={band.onSolid}>
                    {`${Math.round(result.confidence * 100)}% confidence  ·  ?`}
                  </Txt>
                </View>
              </Springy>
            </View>
          </Enter>
        </View>

        <View style={{ paddingHorizontal: S.xl, marginTop: -S.xl }}>
          {/*
            What the percentage means, in the three things that actually move
            it. Written as plain sentences rather than the formula: the point
            is that someone can tell whether a low number is the app being
            broken or the answer genuinely being uncertain.
          */}
          {whyConfidence ? (
            <Card style={{ marginBottom: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Txt t="bodyStrong" style={{ flex: 1 }}>How confidence is worked out</Txt>
                <Springy
                  onPress={() => { tap('light'); setWhyConfidence(false); }}
                  scaleTo={0.85}
                  accessibilityLabel="Close"
                >
                  <Icon name="close" size={16} color={P.muted} />
                </Springy>
              </View>

              <Txt t="caption" style={{ marginTop: S.sm }}>
                Three things are multiplied together, so all of them have to
                hold:
              </Txt>

              <View style={{ marginTop: S.sm }}>
                <Txt t="caption">
                  <Txt t="bodyStrong">How much you told it.</Txt>
                  {' '}One symptom is weak evidence. The second adds a lot, the
                  fourth adds little.
                </Txt>
                <Txt t="caption" style={{ marginTop: S.xs }}>
                  <Txt t="bodyStrong">How clear-cut the score is.</Txt>
                  {' '}A score sitting right on a boundary could fall either
                  way. Ten points clear of one counts as settled.
                </Txt>
                <Txt t="caption" style={{ marginTop: S.xs }}>
                  <Txt t="bodyStrong">How specific the symptoms are.</Txt>
                  {' '}A rash points somewhere. Tiredness fits almost anything.
                </Txt>
              </View>

              <Txt t="caption" c={P.muted} style={{ marginTop: S.md }}>
                It never reads 0%, because the rules are fixed and visible, and
                it never reaches the nineties, because a small rule engine
                cannot know that much. Adding more symptoms is what raises it.
              </Txt>
            </Card>
          ) : null}

          {/* Escalation first. QR5: never below the fold, never after the score. */}
          {escalate ? (
            <Enter index={3}>
              <View style={[st.alert, { backgroundColor: P.surface, borderLeftColor: P.danger }, elev(3)]}>
                <View style={st.alertHead}>
                  <Icon name="alert" size={20} color={P.danger} weight="bold" />
                  <Txt t="heading" c={P.danger} style={{ flex: 1 }}>
                    {result.band === 'EMERGENCY' ? 'Get emergency help now' : 'Get seen today'}
                  </Txt>
                </View>
                {result.redFlags.map((f) => (
                  <View key={f} style={st.flagRow}>
                    <View style={[st.bullet, { backgroundColor: P.danger }]} />
                    <Txt t="body" c={P.inkSoft} style={{ flex: 1 }}>{f}</Txt>
                  </View>
                ))}
                <Springy
                  onPress={() => { tap('error'); Linking.openURL('tel:111'); }}
                  weight="error"
                  accessibilityLabel="Call 111 emergency services"
                  style={[st.call, { backgroundColor: P.danger }, elev(2)]}
                >
                  <Txt t="title" c={P.onDanger}>Call 111</Txt>
                </Springy>
              </View>
            </Enter>
          ) : (
            <Enter index={3}>
              <Card elevated={2}>
                <Txt t="body">{BAND_ADVICE[result.band]}</Txt>
              </Card>
            </Enter>
          )}

          {escalate ? (
            <Enter index={4}>
              <View style={{ height: S.lg }} />
              <Card elevated={1}>
                <Txt t="body">{BAND_ADVICE[result.band]}</Txt>
              </Card>
            </Enter>
          ) : null}

          {/* ── Hosted diagnostic matrix ──────────────────────────────────
              Sits BELOW the band, never above it. The band is decided on the
              device from rules that can be audited; these five are a model's
              ranked guess. Putting probability first is the exact failure this
              project was built to correct - a meningitis row at 42% buried
              under four commoner conditions. */}
          <MatrixSection analysis={analysis} />

          <Enter index={5}>
            <View style={{ height: S.lg }} />
            <Button title="Find care near me" tone="outline" icon="pin" onPress={onFindCare} />
          </Enter>

          {result.rationale.length > 0 ? (
            <Enter index={6}>
              <View style={{ height: S.xxl }} />
              <SectionLabel>What this looked at</SectionLabel>
              <Card>
                {result.rationale.map((r, i) => (
                  <View key={r} style={[st.flagRow, i === 0 && { marginTop: 0 }]}>
                    <View style={[st.bullet, { backgroundColor: P.faint }]} />
                    <Txt t="body" style={{ flex: 1 }}>{r}</Txt>
                  </View>
                ))}
              </Card>
            </Enter>
          ) : null}

          <Enter index={7}>
            <View style={{ height: S.xxl }} />
            <View style={[st.meta, { borderColor: P.line }]}>
              <Icon name="shield" size={16} color={P.ok} />
              <Txt t="caption" style={{ flex: 1 }}>
                {`Checked on this device${elapsedMs !== null ? ` in ${elapsedMs} ms` : ''} using the`}
                {result.source === 'ON_DEVICE_MODEL' ? ' on-device model' : ' rules engine'}
                {result.syncStatus === 'PENDING_SYNC'
                  ? '. A fuller explanation will be added when you are back online.' : '.'}
              </Txt>
            </View>

            <Txt t="caption" style={{ marginTop: S.lg, fontStyle: 'italic' }}>
              This is not a diagnosis and does not replace medical advice. Healthline is free on
              0800 611 116. In an emergency call 111.
            </Txt>
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}

/* ═════════════════ hosted diagnostic matrix ═════════════════════════════ */

/**
 * Severity word -> colour. Critical and High share the danger colour on
 * purpose: at a glance the only question that matters is "is this the serious
 * one", and two near-identical reds would blur that.
 *
 * The word is always rendered alongside the swatch. Colour alone would fail
 * WCAG 1.4.1, and this is precisely the information you cannot afford a
 * colour-blind reader to miss.
 */
function severityColour(s: MatrixSeverity, P: ReturnType<typeof useTheme>['c']): string {
  switch (s) {
    case 'Critical':
    case 'High':     return P.danger;
    case 'Medium':   return P.warn;
    default:         return P.muted;
  }
}

function ConditionRow({ item, rank }: { item: ProbableCondition; rank: number }) {
  const { c: P } = useTheme();
  const colour = severityColour(item.severity, P);
  const width = Math.max(2, Math.min(100, item.confidence));

  return (
    <View style={[st.condRow, rank === 0 && { marginTop: 0 }]}>
      <View style={st.condHead}>
        <Txt t="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>{item.name}</Txt>
        <Txt t="numeric" c={P.muted}>{`${Math.round(item.confidence)}%`}</Txt>
      </View>

      {/* Confidence bar. Graphical, so the 3:1 bar applies, and it is never the
          only carrier of the number - the percentage is printed beside it. */}
      <View style={[st.track, { backgroundColor: P.sunken }]}>
        <View style={[st.fill, { width: `${width}%`, backgroundColor: colour }]} />
      </View>

      <View style={st.condFoot}>
        <View style={[st.sevDot, { backgroundColor: colour }]} />
        <Txt t="micro" c={colour}>{item.severity.toUpperCase()}</Txt>
      </View>
    </View>
  );
}

function Pathway({ title, items }: { title: string; items: readonly string[] }) {
  const { c: P } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: S.md }}>
      <Txt t="micro" c={P.accent} style={st.pathHead}>{title.toUpperCase()}</Txt>
      {items.map((line, i) => (
        <View key={`${line}-${i}`} style={st.flagRow}>
          <View style={[st.bullet, { backgroundColor: P.faint }]} />
          <Txt t="body" style={{ flex: 1 }}>{line}</Txt>
        </View>
      ))}
    </View>
  );
}

function hasAnyPathway(p: SymptomAnalysis['treatmentPathways']): boolean {
  return p.allopathy.length > 0 || p.homeRemedies.length > 0 || p.homeopathic.length > 0;
}

function MatrixSection({ analysis }: { analysis?: RemoteOutcome<SymptomAnalysis> | null }) {
  const { c: P } = useTheme();

  // Still in flight. Say so rather than rendering nothing - an absent section
  // reads as "there is no more information", which is a different claim.
  if (analysis === null || analysis === undefined) {
    /*
     * A working state, not a paragraph explaining one.
     *
     * This was a grey card of text apologising for the wait, which read as a
     * screen that had gone wrong and is the first thing anyone sees after a
     * check. The shape of what is coming says the same thing faster: three
     * rows the size of the conditions that will replace them, pulsing, under
     * a spinner.
     */
    return (
      <Enter index={4}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Possible conditions</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <ActivityIndicator size="small" color={P.accent} />
            <Txt t="bodyStrong" style={{ flex: 1 }}>Analysing your symptoms</Txt>
          </View>

          <View style={{ marginTop: S.lg }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} index={i} />
            ))}
          </View>
        </Card>
      </Enter>
    );
  }

  if (analysis.status !== 'OK' || !analysis.data) {
    return (
      <Enter index={4}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Possible conditions</SectionLabel>
        <Card>
          <Txt t="caption" c={P.muted}>{analysis.notice}</Txt>
        </Card>
      </Enter>
    );
  }

  const { probabilityMatrix, treatmentPathways, summaryText } = analysis.data;

  return (
    <Enter index={4}>
      <View style={{ height: S.xxl }} />
      <SectionLabel>Possible conditions</SectionLabel>
      <Card>
        {probabilityMatrix.map((item, i) => (
          <ConditionRow key={`${item.name}-${i}`} item={item} rank={i} />
        ))}
        <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
          Ranked by likelihood, not by urgency. The band above decides what to do.
        </Txt>
      </Card>

      {summaryText ? (
        <>
          <View style={{ height: S.xxl }} />
          <SectionLabel>Synopsis</SectionLabel>
          <Card><Txt t="body">{summaryText}</Txt></Card>
        </>
      ) : null}

      {hasAnyPathway(treatmentPathways) ? (
        <>
          <View style={{ height: S.xxl }} />
          <SectionLabel>Treatment options</SectionLabel>
          <Card>
            <Pathway title="Medical" items={treatmentPathways.allopathy} />
            <Pathway title="Home remedies" items={treatmentPathways.homeRemedies} />
            <Pathway title="Homeopathic" items={treatmentPathways.homeopathic} />
            <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
              Suggestions only. Confirm any medicine or dose with a pharmacist
              or doctor before taking it.
            </Txt>
          </Card>
        </>
      ) : null}
    </Enter>
  );
}

const st = StyleSheet.create({
  condRow: { marginTop: S.md },
  condHead: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  track: { height: 6, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  condFoot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  pathHead: { letterSpacing: 1.4, marginBottom: 2 },
  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: S.xl,
    paddingTop: S.lg,
    paddingBottom: S.xxl + S.xl,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  figureRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: S.lg },
  conf: { paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.pill, marginBottom: 14 },
  alert: { borderRadius: R.lg, padding: S.lg, borderLeftWidth: 4 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  flagRow: { flexDirection: 'row', gap: S.sm, marginTop: S.sm, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  call: {
    minHeight: TOUCH + 8, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center', marginTop: S.lg,
  },
  meta: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md, padding: S.md,
  },
});

/**
 * One placeholder row, the size of the condition that will replace it.
 *
 * The pulse runs on the JS driver, like every other animation in this app: a
 * natively driven value lives outside the React tree, and Android loses it
 * when it re-attaches the view - which is what made content vanish on scroll
 * here before.
 *
 * Widths descend, because the real list is ranked and its bars do too. A row
 * of identical grey blocks reads as a broken layout; one that already has the
 * shape of the answer reads as the answer arriving.
 */
function Skeleton({ index }: { index: number }) {
  const { c: P } = useTheme();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75, duration: 700, delay: index * 120,
          easing: Easing.inOut(Easing.quad), useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0.35, duration: 700,
          easing: Easing.inOut(Easing.quad), useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, index]);

  return (
    <View style={{ marginTop: index === 0 ? 0 : S.lg }}>
      <Animated.View
        style={{
          height: 13,
          width: `${72 - index * 12}%`,
          borderRadius: R.xs,
          backgroundColor: P.sunken,
          opacity: pulse,
        }}
      />
      <Animated.View
        style={{
          height: 6,
          marginTop: S.sm,
          borderRadius: R.xs,
          backgroundColor: P.sunken,
          opacity: pulse,
        }}
      />
    </View>
  );
}
