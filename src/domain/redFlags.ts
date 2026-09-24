/**
 * FR3 / QR5 - red-flag detection.
 *
 * These rules run BEFORE any scored classification and can never be suppressed
 * by low model confidence. They are deliberately deterministic and readable so
 * they can be reviewed against published triage guidance line by line.
 *
 * ── Traceability (Phase 2) ───────────────────────────────────────────────────
 *
 * Every rule now carries a `source`. This is not decoration: the report claims
 * these rules "trace to published guidance", and a claim nobody can check is
 * not a safety property. The accompanying test asserts the field is populated,
 * so a rule cannot be added later without one.
 *
 * Two honesty rules are encoded in the type rather than left to good intentions:
 *
 *   1. `symptomsCited` says the *symptom set* comes from the named guidance.
 *   2. `thresholdCited` says the numeric trigger - a severity cut-off or a
 *      duration in hours - also comes from it. Where this project chose the
 *      number itself, the flag is false and the rule is reported as needing
 *      clinical sign-off. Publishing an invented threshold under someone
 *      else's citation would be worse than publishing no citation at all.
 */
import { SymptomEpisode, TriageBand } from './entities';

/** Where a rule comes from, so it can be checked and kept current. */
export interface RuleSource {
  readonly publisher: string;
  readonly title: string;
  readonly year: number | null;
  readonly url: string | null;
  /** The guidance names this symptom pattern as requiring the stated urgency. */
  readonly symptomsCited: boolean;
  /** The guidance also specifies the numeric trigger used below. */
  readonly thresholdCited: boolean;
  /** What still needs a clinician's sign-off, when anything does. */
  readonly outstanding?: string;
}

export interface RedFlagRule {
  readonly id: string;
  readonly description: string;
  readonly band: TriageBand;
  readonly source: RuleSource;
  readonly matches: (e: SymptomEpisode) => boolean;
}

/** Rules whose symptom set or threshold is not yet backed by cited guidance. */
export function rulesNeedingReview(
  rules: readonly RedFlagRule[] = RED_FLAG_RULES,
): readonly RedFlagRule[] {
  return rules.filter((r) => !r.source.symptomsCited || !r.source.thresholdCited);
}

const has = (e: SymptomEpisode, code: string) => e.symptoms.some((s) => s.code === code);
const sev = (e: SymptomEpisode, code: string) =>
  e.symptoms.find((s) => s.code === code)?.severity ?? 0;

export const RED_FLAG_RULES: readonly RedFlagRule[] = [
  {
    id: 'RF-CARDIAC',
    description: 'Chest pain with breathlessness or radiating arm/jaw pain',
    band: 'EMERGENCY',
    // "Call 111 and ask for an ambulance if someone has: chest pain or
    // tightness (they may also feel pain or tightness in their arm, jaw, neck
    // or tummy), difficulty breathing..."
    source: {
      publisher: 'Health New Zealand | Te Whatu Ora',
      title: 'Getting help in a medical emergency',
      year: 2025,
      url: 'https://www.healthnz.govt.nz/health-topics/tests-and-treatments/emergencies-and-first-aid/emergency-medical-help',
      symptomsCited: true,
      thresholdCited: true, // presence-based, no numeric cut-off invented
    },
    matches: (e) => has(e, 'chest_pain') && (has(e, 'breathlessness') || has(e, 'radiating_pain')),
  },
  {
    id: 'RF-STROKE',
    description: 'Facial droop, arm weakness or sudden speech difficulty',
    band: 'EMERGENCY',
    // F.A.S.T. - Face drooping, Arm weakness, Speech difficulty, Take action:
    // call 111. The rule is a direct transcription of the campaign.
    source: {
      publisher: 'Stroke Foundation of New Zealand',
      title: 'F.A.S.T. - recognising stroke signs',
      year: 2025,
      url: 'https://www.stroke.org.nz/understanding-stroke/recognising-stroke-signs/fast/',
      symptomsCited: true,
      thresholdCited: true,
    },
    matches: (e) => has(e, 'facial_droop') || has(e, 'arm_weakness') || has(e, 'speech_difficulty'),
  },
  {
    id: 'RF-SEPSIS',
    description: 'High fever with confusion or non-blanching rash',
    band: 'EMERGENCY',
    // NG51 lists non-blanching rash and altered mental state among the
    // high-risk criteria for severe illness or death from sepsis. The fever
    // severity cut-off of 7/10 is this project's, not NICE's - NG51 works from
    // measured temperature and NEWS2 physiology, which a self-report app does
    // not have.
    source: {
      publisher: 'National Institute for Health and Care Excellence',
      title: 'Suspected sepsis: recognition, diagnosis and early management (NG51)',
      year: 2024,
      url: 'https://www.nice.org.uk/guidance/ng51',
      symptomsCited: true,
      thresholdCited: false,
      outstanding: 'Self-reported fever severity >= 7 is a project proxy for NG51 physiological criteria; needs clinical sign-off.',
    },
    matches: (e) => sev(e, 'fever') >= 7 && (has(e, 'confusion') || has(e, 'rash_non_blanching')),
  },
  {
    id: 'RF-BREATHING',
    description: 'Severe breathing difficulty',
    band: 'EMERGENCY',
    // Same Health NZ list: "difficulty breathing" is an ambulance criterion.
    // The 8/10 cut-off is this project's attempt to separate "difficulty" from
    // ordinary breathlessness; the guidance sets no scale.
    source: {
      publisher: 'Health New Zealand | Te Whatu Ora',
      title: 'Getting help in a medical emergency',
      year: 2025,
      url: 'https://www.healthnz.govt.nz/health-topics/tests-and-treatments/emergencies-and-first-aid/emergency-medical-help',
      symptomsCited: true,
      thresholdCited: false,
      outstanding: 'Severity >= 8 as the boundary for "difficulty breathing" is unvalidated; needs clinical sign-off.',
    },
    matches: (e) => sev(e, 'breathlessness') >= 8,
  },
  {
    id: 'RF-MENINGITIS',
    description: 'Severe headache with neck stiffness or light sensitivity',
    band: 'URGENT',
    // "Most cases of meningitis start with a high fever, severe headache and
    // stiff neck... a sensitivity to light, or a dislike of bright lights is an
    // early warning sign."
    //
    // OPEN QUESTION for clinical review: the same source says meningitis "can
    // kill within 24 hours" and directs readers to call 111. This rule bands
    // URGENT, not EMERGENCY. Given that under-triage is the failure this whole
    // system exists to prevent, the band may be one level too low. Flagged
    // rather than changed - banding is a clinical decision, not a coding one.
    source: {
      publisher: 'Meningitis Foundation Aotearoa New Zealand',
      title: 'Know the symptoms',
      year: 2025,
      url: 'https://meningitis.org.nz/know-the-symptoms/',
      symptomsCited: true,
      thresholdCited: false,
      outstanding: 'Band is URGENT while the source directs readers to call 111; review whether this should be EMERGENCY. Headache severity >= 7 is a project threshold.',
    },
    matches: (e) => sev(e, 'headache') >= 7 && (has(e, 'neck_stiffness') || has(e, 'photophobia')),
  },
  {
    id: 'RF-DEHYDRATION-CHILD',
    description: 'Child with prolonged vomiting',
    band: 'URGENT',
    // CG84 establishes that under-5s with gastroenteritis carry red-flag
    // criteria for progression to shock and need urgent review. It does not
    // set a 24-hour vomiting threshold - that number is this project's.
    source: {
      publisher: 'National Institute for Health and Care Excellence',
      title: 'Diarrhoea and vomiting caused by gastroenteritis in under 5s (CG84)',
      year: 2009,
      url: 'https://www.nice.org.uk/guidance/cg84',
      symptomsCited: true,
      thresholdCited: false,
      outstanding: 'The 24-hour duration trigger is not from CG84; CG84 uses clinical dehydration signs. Needs clinical sign-off.',
    },
    matches: (e) => e.ageBand === 'CHILD' && has(e, 'vomiting') && e.durationHours >= 24,
  },
  {
    id: 'RF-OLDER-FEVER',
    description: 'Older adult with sustained fever',
    band: 'URGENT',
    // No source found. This rule was written from reasoning about atypical
    // presentation in older adults, not from guidance. It is left in place
    // because removing it would lower sensitivity, but it is recorded here as
    // uncited so it appears in rulesNeedingReview() and cannot be quietly
    // mistaken for evidence-based.
    source: {
      publisher: 'None - uncited',
      title: 'Project-authored rule, pending a guidance source',
      year: null,
      url: null,
      symptomsCited: false,
      thresholdCited: false,
      outstanding: 'No published source identified for either the symptom pattern or the >= 48 h / severity >= 6 thresholds. Must be sourced or withdrawn before any clinical claim is made.',
    },
    matches: (e) => e.ageBand === 'OLDER_ADULT' && sev(e, 'fever') >= 6 && e.durationHours >= 48,
  },
];

export interface RedFlagOutcome {
  readonly ids: readonly string[];
  readonly descriptions: readonly string[];
  readonly band: TriageBand | null;
}

export function detectRedFlags(e: SymptomEpisode): RedFlagOutcome {
  const hits = RED_FLAG_RULES.filter((r) => r.matches(e));
  if (hits.length === 0) return { ids: [], descriptions: [], band: null };
  const worst = hits.some((h) => h.band === 'EMERGENCY') ? 'EMERGENCY' : 'URGENT';
  return {
    ids: hits.map((h) => h.id),
    descriptions: hits.map((h) => h.description),
    band: worst,
  };
}
