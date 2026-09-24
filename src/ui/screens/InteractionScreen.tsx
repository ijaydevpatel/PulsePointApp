/**
 * FR6 result screen.
 *
 * Structured so the three failure modes of the web app's version are all
 * impossible here:
 *
 *   1. A blank panel that reads as "no interaction". Every outcome renders an
 *      explicit statement, and `CLEAR` is worded as "nothing in this table"
 *      rather than "safe".
 *   2. The worst finding buried below less important ones. Findings arrive
 *      pre-sorted by severity and the header takes its colour from the highest.
 *   3. A medicine silently dropped. Unrecognised entries render above the
 *      findings, not below them, because a result computed over part of
 *      someone's list is more dangerous than no result at all.
 */
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  InteractionReport, InteractionFinding, InteractionSeverity,
  SEVERITY_LABEL, ACTION_LABEL,
} from '../../domain/medicines';
import { MedicineCheck, RemoteOutcome } from '../../domain/remote';
import { Card, SectionLabel, Button, Txt, Springy, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Palette, circle } from '../theme';
import { GlassCircle } from '../components/LiquidGlass';

/**
 * Interaction severity gets its own colour mapping rather than reusing the
 * triage bands. "Major interaction" and "go to hospital" are different claims
 * and must not be able to leak into one another through a shared token.
 */
function severityColour(P: Palette, s: InteractionSeverity) {
  switch (s) {
    case 'MAJOR':    return { fg: P.danger, solid: P.danger, on: P.onDanger };
    case 'MODERATE': return { fg: P.warn, solid: P.warn, on: '#FFFFFF' };
    case 'MINOR':    return { fg: P.muted, solid: P.muted, on: '#FFFFFF' };
  }
}

export function InteractionScreen({ report, check, onBack, onEdit }: {
  report: InteractionReport;
  /**
   * The hosted collision check for the first recognised pair.
   *
   * Null while it is in flight. Undefined when it was never started - two
   * different things, and the section says which.
   */
  check?: RemoteOutcome<MedicineCheck> | null;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { c: P, elev } = useTheme();

  const head = report.highest
    ? severityColour(P, report.highest)
    : { fg: P.ok, solid: P.ok, on: '#FFFFFF' };

  const title =
    report.outcome === 'NOT_ENOUGH' ? 'Not enough to check'
    : report.outcome === 'CLEAR' ? 'Nothing found in this table'
    : report.highest === 'MAJOR' ? 'Major interaction found'
    : report.highest === 'MODERATE' ? 'Moderate interaction found'
    : 'Minor interaction found';

  const sub =
    report.outcome === 'NOT_ENOUGH'
      ? 'Two or more recognised medicines are needed to compare.'
      : `${report.pairsChecked} pair${report.pairsChecked === 1 ? '' : 's'} compared across ${report.recognised.length} medicines.`;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hairline carries the boundary - see the note in ResultScreen. */}
        <View style={[
          st.hero,
          {
            backgroundColor: report.outcome === 'FINDINGS' ? head.solid : P.surface,
            borderColor: report.outcome === 'FINDINGS' ? head.fg : P.line,
          },
        ]}>
          {/*
            Glass only where there is content behind it to refract. On the
            saturated findings hero it degrades to a tinted circle, because
            glass over a flat fill has nothing to bend.
          */}
          <Springy onPress={onBack} scaleTo={0.88} accessibilityLabel="Go back">
            {report.outcome === 'FINDINGS' ? (
              <View style={[circle(TOUCH), st.centred, { backgroundColor: head.on + '26' }]}>
                <Icon name="chevronLeft" size={20} color={head.on} />
              </View>
            ) : (
              <GlassCircle size={TOUCH}>
                <Icon name="chevronLeft" size={20} color={P.ink} />
              </GlassCircle>
            )}
          </Springy>

          <Enter index={1}>
            <View style={{ marginTop: S.xl }}>
              <Icon
                name={report.outcome === 'FINDINGS' ? 'alert' : 'shield'}
                size={28}
                color={report.outcome === 'FINDINGS' ? head.on : P.ok}
                weight="bold"
              />
              <Txt
                t="display"
                c={report.outcome === 'FINDINGS' ? head.on : P.ink}
                style={{ marginTop: S.md }}
              >
                {title}
              </Txt>
              <Txt
                t="caption"
                c={report.outcome === 'FINDINGS' ? head.on + 'CC' : P.muted}
                style={{ marginTop: 6 }}
              >
                {sub}
              </Txt>
            </View>
          </Enter>
        </View>

        <View style={{ paddingHorizontal: S.xl, marginTop: S.lg }}>
          {/*
            Unrecognised first. This is the one thing that must never sit below
            a result, because it changes what the result means.
          */}
          {report.unrecognised.length > 0 ? (
            <Enter index={2}>
              <View style={[st.warn, { backgroundColor: P.surface, borderLeftColor: P.warn }, elev(2)]}>
                <View style={st.warnHead}>
                  <Icon name="alert" size={18} color={P.warn} weight="bold" />
                  <Txt t="heading" c={P.warn} style={{ flex: 1 }}>
                    {report.unrecognised.length === 1
                      ? 'One medicine was not recognised'
                      : `${report.unrecognised.length} medicines were not recognised`}
                  </Txt>
                </View>
                <Txt t="body" style={{ marginTop: S.sm }}>
                  {report.unrecognised.join(', ')}
                </Txt>
                <Txt t="caption" style={{ marginTop: S.sm }}>
                  {report.outcome === 'FINDINGS'
                    ? 'These were left out of the check, so this result does not cover your full list. Check the spelling, or ask a pharmacist.'
                    : 'These were left out, so nothing could be concluded about them. Check the spelling, or ask a pharmacist.'}
                </Txt>
              </View>
              <View style={{ height: S.lg }} />
            </Enter>
          ) : null}

          {report.findings.map((f, i) => (
            <Enter key={`${f.ruleId}-${f.first}-${f.second}`} index={3 + i}>
              <FindingCard finding={f} />
            </Enter>
          ))}

          {report.outcome === 'CLEAR' ? (
            <Enter index={3}>
              <Card elevated={1}>
                <Txt t="body">
                  No interaction between these medicines appears in the app's table. That is
                  not the same as being safe together - this table covers common medicines
                  and well-established interactions, not every combination.
                </Txt>
                <Txt t="bodyStrong" style={{ marginTop: S.md }}>
                  A pharmacist can check your full list, including anything bought over the
                  counter, and it costs nothing to ask.
                </Txt>
              </Card>
            </Enter>
          ) : null}

          <CollisionSection check={check} />

          {report.recognised.length > 0 ? (
            <Enter index={9}>
              <View style={{ height: S.xxl }} />
              <SectionLabel>Medicines checked</SectionLabel>
              <View style={st.pills}>
                {report.recognised.map((m) => (
                  <View key={m} style={[st.pill, { backgroundColor: P.sunken }]}>
                    <Txt t="micro" c={P.inkSoft}>{m}</Txt>
                  </View>
                ))}
              </View>
            </Enter>
          ) : null}

          <Enter index={10}>
            <View style={{ height: S.xl }} />
            <Button title="Edit my list" tone="ghost" icon="plus" onPress={onEdit} />

            <View style={{ height: S.xxl }} />
            <View style={[st.meta, { borderColor: P.line }]}>
              <Icon name="shield" size={16} color={P.ok} />
              <Txt t="caption" style={{ flex: 1 }}>
                {check === undefined
                  ? 'Checked on this device against a bundled table. Nothing was sent anywhere, and the check works with no connection.'
                  : 'The table check runs on this device and works with no connection. The collision check above sends the two medicine names to the analysis service - nothing else about you goes with them.'}
              </Txt>
            </View>

            <Txt t="caption" style={{ marginTop: S.lg, fontStyle: 'italic' }}>
              This does not replace advice from a pharmacist or doctor, and it does not cover
              every medicine or every interaction. Never stop a prescribed medicine because of
              what you read here - ask first. Healthline is free on 0800 611 116.
            </Txt>
          </Enter>
        </View>
      </ScrollView>
    </View>
  );
}

function FindingCard({ finding }: { finding: InteractionFinding }) {
  const { c: P } = useTheme();
  const sc = severityColour(P, finding.severity);

  return (
    <Card style={{ marginBottom: S.md, borderLeftWidth: 4, borderLeftColor: sc.fg }} elevated={2}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <View style={[st.sevTag, { backgroundColor: sc.solid }]}>
          <Txt t="micro" c={sc.on}>{SEVERITY_LABEL[finding.severity].toUpperCase()}</Txt>
        </View>
        <Txt t="micro" c={P.muted} style={{ flex: 1 }} numberOfLines={1}>
          {ACTION_LABEL[finding.action]}
        </Txt>
      </View>

      <Txt t="title" style={{ marginTop: S.md }}>
        {`${finding.first} + ${finding.second}`}
      </Txt>

      <Txt t="body" style={{ marginTop: S.sm }}>{finding.effect}</Txt>

      <View style={[st.advice, { backgroundColor: P.sunken }]}>
        <Txt t="bodyStrong" style={{ marginBottom: 4 }}>What to do</Txt>
        <Txt t="body">{finding.advice}</Txt>
      </View>

      <Txt t="micro" style={{ marginTop: S.md }}>{`Source: ${finding.source}`}</Txt>
    </Card>
  );
}

/**
 * The hosted opinion, underneath the table's.
 *
 * Two checks with different characters sit on this screen and must not be
 * mistaken for one another. The table is deterministic, offline, and says
 * nothing it cannot support - but it knows 35 rules. The model has read far
 * more and will comment on any pair, including the one the table has never
 * heard of, and it is a model: it can be confidently wrong.
 *
 * So this is a separate section with its own heading and its own caveat,
 * below the table's findings rather than merged into them. A reader can tell
 * which check said what, which they could not if the two were interleaved.
 */
function CollisionSection({ check }: { check?: RemoteOutcome<MedicineCheck> | null }) {
  const { c: P } = useTheme();

  // Never started. Say nothing rather than implying a check that is not coming.
  if (check === undefined) return null;

  if (check === null) {
    return (
      <Enter index={8}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Collision check</SectionLabel>
        <Card elevated={1}>
          <Txt t="caption" c={P.muted}>
            Running the collision check. This can take up to a minute - the table
            result above is already complete.
          </Txt>
        </Card>
      </Enter>
    );
  }

  if (check.status !== 'OK' || !check.data) {
    return (
      <Enter index={8}>
        <View style={{ height: S.xxl }} />
        <SectionLabel>Collision check</SectionLabel>
        <Card elevated={1}>
          <Txt t="caption" c={P.muted}>{check.notice}</Txt>
        </Card>
      </Enter>
    );
  }

  const d = check.data;
  const tone = d.dangerDetected ? P.danger : P.ok;

  return (
    <Enter index={8}>
      <View style={{ height: S.xxl }} />
      <SectionLabel>Collision check</SectionLabel>

      <Card elevated={2}>
        <View style={st.warnHead}>
          <Icon name={d.dangerDetected ? 'alert' : 'shield'} size={18} color={tone} weight="bold" />
          <Txt t="heading" c={tone} style={{ flex: 1 }}>{d.compatibilityVerdict}</Txt>
        </View>

        {d.riskLevel ? (
          <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
            {`Risk: ${d.riskLevel}`}
          </Txt>
        ) : null}

        {d.explanation ? (
          <Txt t="body" style={{ marginTop: S.md }}>{d.explanation}</Txt>
        ) : null}

        {d.conflictFlags.length > 0 ? (
          <>
            <Txt t="micro" c={P.accent} style={st.blockHead}>WHAT TO WATCH</Txt>
            {d.conflictFlags.map((f, i) => (
              <View key={`${f}-${i}`} style={st.bulletRow}>
                <View style={[st.dot, { backgroundColor: P.warn }]} />
                <Txt t="body" style={{ flex: 1 }}>{f}</Txt>
              </View>
            ))}
          </>
        ) : null}

        {d.warnings.length > 0 ? (
          <>
            <Txt t="micro" c={P.accent} style={st.blockHead}>WARNINGS</Txt>
            {d.warnings.map((w, i) => (
              <View key={`${w}-${i}`} style={st.bulletRow}>
                <View style={[st.dot, { backgroundColor: P.danger }]} />
                <Txt t="body" style={{ flex: 1 }}>{w}</Txt>
              </View>
            ))}
          </>
        ) : null}

        {d.safeAlternatives.length > 0 ? (
          <>
            <Txt t="micro" c={P.accent} style={st.blockHead}>ALTERNATIVES TO ASK ABOUT</Txt>
            {d.safeAlternatives.map((a, i) => (
              <View key={`${a}-${i}`} style={st.bulletRow}>
                <View style={[st.dot, { backgroundColor: P.ok }]} />
                <Txt t="body" style={{ flex: 1 }}>{a}</Txt>
              </View>
            ))}
            {/*
              "Safe alternatives" is the field name on the wire and it is not a
              claim this screen will repeat. Nothing here has been checked
              against the reader's other medicines, allergies or conditions.
            */}
            <Txt t="micro" c={P.faint} style={{ marginTop: S.sm }}>
              Suggestions to raise with a pharmacist, not substitutions to make
              on your own.
            </Txt>
          </>
        ) : null}
      </Card>
    </Enter>
  );
}

const st = StyleSheet.create({
  blockHead: { letterSpacing: 1.4, marginTop: S.lg, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', gap: S.sm, marginTop: S.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: S.xl, paddingTop: S.lg, paddingBottom: S.xxl,
    borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl,
  },
  centred: { alignItems: 'center', justifyContent: 'center' },
  warn: { borderRadius: R.lg, padding: S.lg, borderLeftWidth: 4 },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sevTag: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  advice: { marginTop: S.md, padding: S.md, borderRadius: R.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  pill: { paddingHorizontal: S.md, paddingVertical: 7, borderRadius: R.pill },
  meta: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md, padding: S.md,
  },
});
