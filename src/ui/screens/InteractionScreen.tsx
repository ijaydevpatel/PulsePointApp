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

export function InteractionScreen({ report, onBack, onEdit }: {
  report: InteractionReport; onBack: () => void; onEdit: () => void;
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
                Checked on this device against a bundled table. Nothing was sent anywhere,
                and the check works with no connection.
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

const st = StyleSheet.create({
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
