/**
 * FR1, FR3, QR5. Red-flag escalation sits above everything else on the screen.
 *
 * This is the one screen that gets the expressive treatment. Everywhere else
 * the app is deliberately quiet; here it has something to say, so the band
 * fills the top of the screen edge to edge and the severity figure is set at
 * 76pt. The web app buried a 42% meningitis reading in the least prominent row
 * of a table — this layout makes that failure mode structurally impossible,
 * because the band decides the colour of the screen.
 *
 * The number counts up rather than appearing. That is not decoration: a value
 * that animates from zero communicates that it was computed, and it gives the
 * eye a reason to land on the figure before the advice below it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, Animated, Easing } from 'react-native';
import { TriageResult, BAND_LABEL, BAND_ADVICE, requiresEscalation } from '../../domain/entities';
import { SeveritySpine } from '../components/SeveritySpine';
import { Card, SectionLabel, Button, Txt, Springy, Enter, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, TYPE, S, R, TOUCH, TAB_CLEARANCE, MOTION, circle } from '../theme';

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

export function ResultScreen({ result, elapsedMs, onBack, onFindCare }: {
  result: TriageResult; elapsedMs: number | null;
  onBack: () => void; onFindCare: () => void;
}) {
  const { c: P, band: B, elev } = useTheme();
  const band = B[result.band];
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
          pass honestly — remove it and QR6 is no longer met.
        */}
        <View style={[
          st.hero,
          { backgroundColor: band.solid, borderColor: band.solidEdge },
        ]}>
          <View style={st.heroTop}>
            {/*
              Not glass here. The hero is a saturated fill, and liquid glass
              over a flat colour has nothing to refract — it would read as a
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
            <SeveritySpine band={result.band} height={30} width={5} color={band.onSolid} />
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
              <View style={[st.conf, { backgroundColor: band.onSolid + '1F' }]}>
                <Txt t="micro" c={band.onSolid}>
                  {`${Math.round(result.confidence * 100)}% confidence`}
                </Txt>
              </View>
            </View>
          </Enter>
        </View>

        <View style={{ paddingHorizontal: S.xl, marginTop: -S.xl }}>
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

          <Enter index={5}>
            <View style={{ height: S.lg }} />
            <Button title="Find care near me" tone="ghost" icon="pin" onPress={onFindCare} />
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

const st = StyleSheet.create({
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
