/**
 * The collision report for one pair of medicines.
 *
 * ── Order ────────────────────────────────────────────────────────────────────
 *
 * Verdict, then what to do, then why, then the detail. The web version leads
 * with the mechanism and puts the advice in a second column, which reads well
 * on a wide screen and badly on a phone, where "do not take both together"
 * ends up below several hundred words of pharmacology. On a narrow column the
 * only thing that guarantees the instruction is read is putting it first.
 *
 * ── The offline table underneath ─────────────────────────────────────────────
 *
 * The bundled table runs on the same pair and appears below the model's
 * answer, or instead of it when the network does not respond. It knows 35
 * rules against the model's far wider reading, but it is deterministic and
 * cannot invent anything, so it is worth showing when it has something to say
 * and worth keeping when the model is unreachable. The two are always
 * labelled separately - a reader can tell which said what.
 */
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { InteractionReport } from '../../domain/medicines';
import { AgentProfile, MedicineCheck, RemoteOutcome } from '../../domain/remote';
import { Card, SectionLabel, Button, Txt, Springy, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Palette, circle } from '../theme';
import { GlassCircle } from '../components/LiquidGlass';

/**
 * Risk word to colour.
 *
 * Its own mapping rather than the triage bands: "High" here means the two
 * medicines interfere, not that the person should go to hospital, and the two
 * claims must not be able to leak into one another through a shared token.
 */
function riskColour(P: Palette, risk: string, danger: boolean) {
  const r = risk.toLowerCase();
  if (danger || r === 'critical' || r === 'high') return { fg: P.danger, on: P.onDanger };
  if (r === 'medium' || r === 'moderate') return { fg: P.warn, on: '#FFFFFF' };
  if (r === 'low') return { fg: P.ok, on: '#FFFFFF' };
  return { fg: P.muted, on: '#FFFFFF' };
}

/** A prose block with a small heading, skipped entirely when empty. */
function Block({ title, body }: { title: string; body: string }) {
  const { c: P } = useTheme();
  if (!body) return null;
  return (
    <>
      <Txt t="micro" c={P.accent} style={st.blockHead}>{title.toUpperCase()}</Txt>
      <Txt t="body">{body}</Txt>
    </>
  );
}

function Bullets({ title, items, colour }: {
  title: string; items: readonly string[]; colour: string;
}) {
  const { c: P } = useTheme();
  if (items.length === 0) return null;
  return (
    <>
      <Txt t="micro" c={P.accent} style={st.blockHead}>{title.toUpperCase()}</Txt>
      {items.map((line, i) => (
        <View key={`${line}-${i}`} style={st.bulletRow}>
          <View style={[st.dot, { backgroundColor: colour }]} />
          <Txt t="body" style={{ flex: 1 }}>{line}</Txt>
        </View>
      ))}
    </>
  );
}

function AgentCard({ label, agent }: { label: string; agent: AgentProfile }) {
  const { c: P } = useTheme();
  const row = (name: string, value: string) =>
    (value ? (
      <View style={{ marginTop: S.sm }}>
        <Txt t="micro" c={P.faint}>{name.toUpperCase()}</Txt>
        <Txt t="caption" c={P.inkSoft}>{value}</Txt>
      </View>
    ) : null);

  return (
    <View style={[st.agent, { backgroundColor: P.sunken }]}>
      <Txt t="micro" c={P.faint}>{label.toUpperCase()}</Txt>
      <Txt t="bodyStrong" style={{ marginTop: 2 }}>{agent.active}</Txt>
      {row('Binders', agent.binders)}
      {row('Coating', agent.coatings)}
      {row('Additives', agent.additives)}
    </View>
  );
}

export function CollisionScreen({ pair, check, report, onBack, onEdit }: {
  pair: [string, string];
  /** Null while in flight, undefined when no check was started. */
  check?: RemoteOutcome<MedicineCheck> | null;
  /** The on-device table's verdict on the same pair. */
  report: InteractionReport;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { c: P, elev } = useTheme();
  const data = check && check.status === 'OK' ? check.data : null;
  const tone = data
    ? riskColour(P, data.riskLevel, data.dangerDetected)
    : { fg: P.muted, on: '#FFFFFF' };

  const heading = data
    ? data.compatibilityVerdict
    : check === null ? 'Checking' : 'Checked on this device';

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.hero, { backgroundColor: P.surface, borderColor: P.line }]}>
          <Springy onPress={onBack} scaleTo={0.88} accessibilityLabel="Go back">
            <GlassCircle size={TOUCH}>
              <Icon name="chevronLeft" size={20} color={P.ink} />
            </GlassCircle>
          </Springy>

          <Enter index={1}>
            <View style={{ marginTop: S.xl }}>
              <Txt t="section" c={P.muted}>{`${pair[0]}  +  ${pair[1]}`}</Txt>
              <View style={st.verdictRow}>
                <Txt t="display" style={{ flex: 1 }}>{heading}</Txt>
                {data ? (
                  <View style={[st.risk, { backgroundColor: tone.fg }]}>
                    <Txt t="micro" c={tone.on}>{`RISK: ${data.riskLevel.toUpperCase()}`}</Txt>
                  </View>
                ) : null}
              </View>
            </View>
          </Enter>
        </View>

        <View style={{ paddingHorizontal: S.xl, marginTop: S.lg }}>
          {/* In flight. Say so - an absent section reads as "nothing found". */}
          {check === null ? (
            <Enter index={2}>
              <Card elevated={1}>
                <Txt t="caption" c={P.muted}>
                  Running the collision check. This can take up to a minute.
                </Txt>
              </Card>
            </Enter>
          ) : null}

          {check && check.status !== 'OK' ? (
            <Enter index={2}>
              <Card elevated={1}>
                <Txt t="caption" c={P.muted}>{check.notice}</Txt>
              </Card>
            </Enter>
          ) : null}

          {data ? (
            <>
              {/*
                Advice first. On a narrow column this is the only placement
                that guarantees the instruction is read before the
                pharmacology, rather than after several hundred words of it.
              */}
              <Enter index={2}>
                <Card elevated={2}>
                  <View style={st.headRow}>
                    <Icon
                      name={data.dangerDetected ? 'alert' : 'shield'}
                      size={18} color={tone.fg} weight="bold"
                    />
                    <Txt t="heading" c={tone.fg} style={{ flex: 1 }}>What to do</Txt>
                  </View>
                  <Txt t="body" style={{ marginTop: S.sm }}>
                    {data.patientAdvice || 'Ask a pharmacist before taking these together.'}
                  </Txt>
                  <Bullets title="Critical markers" items={data.warnings} colour={P.danger} />
                  <Bullets title="Also flagged" items={data.conflictFlags} colour={P.warn} />
                </Card>
              </Enter>

              <Enter index={3}>
                <View style={{ height: S.xxl }} />
                <SectionLabel>Why</SectionLabel>
                <Card glass={true}>
                  <Block title="Mechanism" body={data.interactionCause} />
                  <Block title="Clinical rationale" body={data.explanation} />
                  <Block title="Metabolic pathway" body={data.metabolicPathway} />
                </Card>
              </Enter>

              {data.agentA || data.agentB ? (
                <Enter index={4}>
                  <View style={{ height: S.xxl }} />
                  <SectionLabel>Molecular profile</SectionLabel>
                  {data.agentA ? <AgentCard label={pair[0]} agent={data.agentA} /> : null}
                  {data.agentB ? <AgentCard label={pair[1]} agent={data.agentB} /> : null}
                </Enter>
              ) : null}

              {data.safeAlternatives.length > 0 ? (
                <Enter index={5}>
                  <View style={{ height: S.xxl }} />
                  <SectionLabel>Alternatives to ask about</SectionLabel>
                  <Card glass={true}>
                    {data.safeAlternatives.map((a, i) => (
                      <View key={`${a}-${i}`} style={st.bulletRow}>
                        <View style={[st.dot, { backgroundColor: P.ok }]} />
                        <Txt t="body" style={{ flex: 1 }}>{a}</Txt>
                      </View>
                    ))}
                    {/*
                      "Safe alternatives" is the field name on the wire and
                      this screen will not repeat it as a claim: nothing here
                      has been checked against the reader's other medicines,
                      allergies or conditions.
                    */}
                    <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
                      Suggestions to raise with a pharmacist, not substitutions
                      to make on your own.
                    </Txt>
                  </Card>
                </Enter>
              ) : null}
            </>
          ) : null}

          {/* The offline table, always labelled as a separate opinion. */}
          {report.findings.length > 0 ? (
            <Enter index={6}>
              <View style={{ height: S.xxl }} />
              <SectionLabel>Also in the offline table</SectionLabel>
              <Card elevated={1}>
                {report.findings.map((f) => (
                  <View key={`${f.ruleId}-${f.first}-${f.second}`} style={{ marginBottom: S.md }}>
                    <Txt t="bodyStrong" c={P.danger}>{`${f.first} + ${f.second}`}</Txt>
                    <Txt t="body" style={{ marginTop: 2 }}>{f.effect}</Txt>
                  </View>
                ))}
                <Txt t="micro" c={P.faint}>
                  A deterministic rule held on the device. It covers common
                  medicines and well-established interactions, not everything.
                </Txt>
              </Card>
            </Enter>
          ) : null}

          <Enter index={7}>
            <View style={{ height: S.xl }} />
            <Button title="Check another pair" tone="ghost" icon="plus" onPress={onEdit} />

            <View style={{ height: S.xxl }} />
            <View style={[st.meta, { borderColor: P.line }]}>
              <Icon name="shield" size={16} color={P.ok} />
              <Txt t="caption" style={{ flex: 1 }}>
                The table check runs on this device. The collision check sends
                the two medicine names to the analysis service - nothing else
                about you goes with them.
              </Txt>
            </View>

            <Txt t="caption" style={{ marginTop: S.lg, fontStyle: 'italic' }}>
              This does not replace advice from a pharmacist or doctor. Never
              stop a prescribed medicine because of what you read here - ask
              first. Healthline is free on 0800 611 116.
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
    paddingBottom: S.xxl,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  verdictRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.md, marginTop: 6,
  },
  risk: { paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.pill, marginTop: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  blockHead: { letterSpacing: 1.4, marginTop: S.lg, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', gap: S.sm, marginTop: S.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  agent: { borderRadius: R.lg, padding: S.lg, marginBottom: S.sm },
  meta: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md, padding: S.md,
  },
});
