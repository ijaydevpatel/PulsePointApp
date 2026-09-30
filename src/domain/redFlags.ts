import { SymptomEpisode, TriageBand } from './entities';

export interface RuleSource {
  readonly publisher: string;
  readonly title: string;
  readonly year: number | null;
  readonly url: string | null;

  readonly symptomsCited: boolean;

  readonly thresholdCited: boolean;

  readonly outstanding?: string;
}

export interface RedFlagRule {
  readonly id: string;
  readonly description: string;
  readonly band: TriageBand;
  readonly source: RuleSource;
  readonly matches: (e: SymptomEpisode) => boolean;
}

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

    source: {
      publisher: 'Health New Zealand | Te Whatu Ora',
      title: 'Getting help in a medical emergency',
      year: 2025,
      url: 'https://www.healthnz.govt.nz/health-topics/tests-and-treatments/emergencies-and-first-aid/emergency-medical-help',
      symptomsCited: true,
      thresholdCited: true,
    },
    matches: (e) => has(e, 'chest_pain') && (has(e, 'breathlessness') || has(e, 'radiating_pain')),
  },
  {
    id: 'RF-STROKE',
    description: 'Facial droop, arm weakness or sudden speech difficulty',
    band: 'EMERGENCY',

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
