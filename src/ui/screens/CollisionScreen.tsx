import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AgentProfile, MedicineCheck, RemoteOutcome } from '../../domain/remote';
import { reconcileMedicineCheck } from '../../domain/medicineVerdict';
import { Card, SectionLabel, Button, Txt, Springy, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, Palette, circle } from '../theme';

function riskColour(P: Palette, risk: string, danger: boolean) {
  const r = risk.toLowerCase();
  if (danger || r === 'critical' || r === 'high') return { fg: P.danger, on: P.onDanger };
  if (r === 'medium' || r === 'moderate') return { fg: P.warn, on: '#FFFFFF' };
  if (r === 'low') return { fg: P.ok, on: '#FFFFFF' };
  return { fg: P.muted, on: '#FFFFFF' };
}

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

export function CollisionScreen({ pair, check, onBack, onEdit }: {
  pair: [string, string];

  check?: RemoteOutcome<MedicineCheck> | null;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { c: P, elev } = useTheme();
  const data = check && check.status === 'OK' ? check.data : null;
  const shown = data ? reconcileMedicineCheck(data) : null;
  const tone = shown
    ? riskColour(P, shown.risk, data!.dangerDetected)
    : { fg: P.muted, on: '#FFFFFF' };

  const heading = shown
    ? shown.verdict
    : check === null ? 'Checking' : 'Check did not complete';

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.hero, { backgroundColor: P.surface, borderColor: P.line }]}>
          <Springy onPress={onBack} scaleTo={0.88} accessibilityLabel="Go back">
            <View style={[st.back, { backgroundColor: P.surface, borderColor: P.line }]}>
              <Icon name="chevronLeft" size={20} color={P.ink} />
            </View>
          </Springy>

          <Enter index={1}>
            <View style={{ marginTop: S.xl }}>
              <Txt t="section" c={P.muted}>{`${pair[0]}  +  ${pair[1]}`}</Txt>
              <View style={st.verdictRow}>
                <Txt t="display" style={{ flex: 1 }}>{heading}</Txt>
                {shown ? (
                  <View style={[st.risk, { backgroundColor: tone.fg }]}>
                    <Txt t="micro" c={tone.on}>{`RISK: ${shown.risk}`}</Txt>
                  </View>
                ) : null}
              </View>
              {shown && shown.escalated ? (
                <Txt t="caption" c={P.muted} style={{ marginTop: S.sm }}>
                  {`Raised from ${data!.riskLevel.toUpperCase()} because ${shown.reason}.`}
                </Txt>
              ) : null}
            </View>
          </Enter>
        </View>

        <View style={{ paddingHorizontal: S.xl, marginTop: S.lg }}>
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
                </Card>
              </Enter>

              {data.interactionCause || data.explanation || data.metabolicPathway ? (
              <Enter index={3}>
                <View style={{ height: S.xxl }} />
                <SectionLabel>Why</SectionLabel>
                <Card>
                  <Txt t="body">{data.interactionCause || data.explanation}</Txt>
                  <Block title="Metabolic pathway" body={data.metabolicPathway} />
                </Card>
              </Enter>
              ) : null}

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
                  <Card>
                    {data.safeAlternatives.map((a, i) => (
                      <View key={`${a}-${i}`} style={st.bulletRow}>
                        <View style={[st.dot, { backgroundColor: P.ok }]} />
                        <Txt t="body" style={{ flex: 1 }}>{a}</Txt>
                      </View>
                    ))}
                    <Txt t="micro" c={P.faint} style={{ marginTop: S.md }}>
                      Suggestions to raise with a pharmacist, not substitutions
                      to make on your own.
                    </Txt>
                  </Card>
                </Enter>
              ) : null}
            </>
          ) : null}

          <Enter index={7}>
            <View style={{ height: S.xl }} />
            <Button title="Check another pair" tone="ghost" icon="plus" onPress={onEdit} />

            <View style={{ height: S.xl }} />
            <Txt t="caption" style={{ fontStyle: 'italic' }}>
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
  back: {
    width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center', justifyContent: 'center',
  },
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
