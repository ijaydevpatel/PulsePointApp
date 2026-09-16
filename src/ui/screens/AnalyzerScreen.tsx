/**
 * Analyzer — POST /api/reports/analyze.
 *
 * Takes a PDF or image of a medical report, uploads it as multipart under the
 * field name `reportFile` (the route runs `upload.single('reportFile')`, so the
 * name is not negotiable), and renders what Gemini extracted.
 *
 * ── Two things this screen is careful about ──────────────────────────────────
 *
 * The risk level leads, because a person who has just uploaded a blood test is
 * looking for one thing first. It is colour-coded but never colour-only — the
 * word is always present, since roughly one in twelve men cannot separate the
 * red from the amber.
 *
 * Nothing here is a diagnosis, and the footer says so in plain words rather
 * than in small print. The backend's own prompt asks for a clinical preamble
 * and a waitlist, which reads authoritative enough to be mistaken for one.
 */
import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt, Button, Card, Springy, EmptyState, SectionLabel, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TAB_CLEARANCE } from '../theme';
import { ReportService, ReportAnalysis, ReportRisk } from '../../domain/remote';

/** Risk word -> palette role. Unknown stays neutral rather than guessing. */
function riskTone(risk: ReportRisk, P: ReturnType<typeof useTheme>['c']) {
  switch (risk) {
    case 'Critical': return { fg: P.onDanger, bg: P.danger };
    case 'High':     return { fg: P.onDanger, bg: P.danger };
    case 'Moderate': return { fg: P.ink,      bg: P.warn + '2E' };
    case 'Low':      return { fg: P.ink,      bg: P.ok + '2E' };
    default:         return { fg: P.ink,      bg: P.sunken };
  }
}

export function AnalyzerScreen({ service }: { service: ReportService }) {
  const { c: P } = useTheme();

  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ReportAnalysis | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickAndAnalyze = useCallback(async () => {
    setNotice(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,   // the uri must stay readable for the upload
      multiple: false,
    });

    // Cancelling is not an error and must not leave a notice behind.
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0]!;
    setFileName(asset.name);
    setReport(null);
    setBusy(true);
    tap('light');

    const r = await service.analyze({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    });

    if (r.status === 'OK' && r.data) {
      setReport(r.data);
      tap('success');
    } else {
      setNotice(r.notice);
      tap('warn');
    }
    setBusy(false);
  }, [service]);

  const tone = report ? riskTone(report.riskLevel, P) : null;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Analyzer" subtitle="Read a report or scan" />

      <ScrollView contentContainerStyle={st.body}>
        {!report && !busy ? (
          <EmptyState
            icon="file"
            title="Upload a report"
            body="A PDF or a photo of a blood test, scan or discharge summary."
          />
        ) : null}

        {notice ? (
          <View style={[st.notice, { backgroundColor: P.dangerSoft, borderColor: P.danger + '40' }]}>
            <Icon name="alert" size={16} color={P.danger} />
            <Txt t="caption" c={P.danger} style={{ flex: 1 }}>{notice}</Txt>
          </View>
        ) : null}

        {fileName ? (
          <View style={[st.fileRow, { backgroundColor: P.sunken }]}>
            <Icon name="file" size={16} color={P.muted} />
            <Txt t="caption" numberOfLines={1} style={{ flex: 1 }}>{fileName}</Txt>
          </View>
        ) : null}

        {busy ? (
          <View style={st.centre}>
            <ActivityIndicator color={P.accent} />
            <Txt t="caption" c={P.muted} center style={{ marginTop: S.sm }}>
              Reading the document. This can take up to a minute.
            </Txt>
          </View>
        ) : null}

        {report && tone ? (
          <>
            {/* Risk first, worded as well as coloured. */}
            <View style={[st.riskBar, { backgroundColor: tone.bg }]}>
              <Txt t="micro" c={tone.fg} style={st.eyebrow}>OVERALL RISK</Txt>
              <Txt t="title" c={tone.fg} style={{ marginTop: 2 }}>{report.riskLevel}</Txt>
            </View>

            <Card style={st.card}>
              <SectionLabel>Document</SectionLabel>
              <Txt t="bodyStrong">{report.documentType}</Txt>
              <Txt t="caption" style={{ marginTop: 2 }}>{report.patientIdentity}</Txt>
            </Card>

            {report.abnormalMarkers.length > 0 ? (
              <Card style={st.card}>
                <SectionLabel>Abnormal markers</SectionLabel>
                {report.abnormalMarkers.map((m, i) => (
                  <View key={`${m}-${i}`} style={st.bullet}>
                    <View style={[st.dot, { backgroundColor: P.danger }]} />
                    <Txt t="body" style={{ flex: 1 }}>{m}</Txt>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={st.card}>
              <SectionLabel>Findings</SectionLabel>
              <Txt t="body">{report.findings}</Txt>
            </Card>

            {report.implications ? (
              <Card style={st.card}>
                <SectionLabel>What it may mean</SectionLabel>
                <Txt t="body">{report.implications}</Txt>
              </Card>
            ) : null}

            {report.advice ? (
              <Card style={st.card}>
                <SectionLabel>Suggested next steps</SectionLabel>
                <Txt t="body">{report.advice}</Txt>
              </Card>
            ) : null}

            <Txt t="micro" c={P.faint} center style={st.legal}>
              This is an automated reading of your document, not a diagnosis.
              Take the report itself to a clinician.
            </Txt>
          </>
        ) : null}
      </ScrollView>

      <View style={[st.actions, { backgroundColor: P.surface, borderTopColor: P.line }]}>
        <Button
          title={report ? 'Analyze another' : 'Choose a file'}
          onPress={() => void pickAndAnalyze()}
          busy={busy}
          icon="file"
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  body: { padding: S.md, paddingBottom: S.lg, gap: S.sm },
  centre: { paddingVertical: S.xl, alignItems: 'center' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    padding: S.md, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth,
  },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.md,
  },
  riskBar: { padding: S.md, borderRadius: R.lg },
  eyebrow: { letterSpacing: 1.6 },
  card: { padding: S.md },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, marginTop: S.xs },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  legal: { marginTop: S.sm, paddingHorizontal: S.md },
  actions: {
    paddingHorizontal: S.md, paddingTop: S.sm,
    paddingBottom: TAB_CLEARANCE - 40,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
