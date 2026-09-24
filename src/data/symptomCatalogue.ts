import { Symptom } from '../domain/entities';

/**
 * Everything the checker can be told about, in one list.
 *
 * ── Order is clinical, not alphabetical ──────────────────────────────────────
 *
 * The red-flag symptoms come first. They are the ones that change the band,
 * and someone with chest pain should not have to scroll past "itching" to find
 * it. Everything after them is the common-complaint set, grouped by system.
 *
 * ── Codes are load-bearing ───────────────────────────────────────────────────
 *
 * src/domain/redFlags.ts matches on `code`, so renaming one silently disables
 * a rule. The thirteen the rules reference are marked below. Adding entries is
 * safe; changing those strings is not.
 *
 * ── On the two rash entries ──────────────────────────────────────────────────
 *
 * `rash_non_blanching` and `skin_rash` look like duplicates and are not. A
 * rash that does not fade under pressure is the meningococcal sign that sends
 * someone to hospital; an ordinary itchy rash is not. Collapsing them into one
 * row would lose the distinction the red-flag rule exists to catch.
 */
export const CATALOGUE: readonly Omit<Symptom, 'severity'>[] = [
  /* ── red-flag set: every code here is matched by a rule ── */
  { code: 'chest_pain', label: 'Chest pain' },
  { code: 'breathlessness', label: 'Breathlessness' },
  { code: 'radiating_pain', label: 'Pain spreading to arm or jaw' },
  { code: 'facial_droop', label: 'Facial droop' },
  { code: 'arm_weakness', label: 'Arm weakness' },
  { code: 'speech_difficulty', label: 'Difficulty speaking' },
  { code: 'confusion', label: 'Confusion' },
  { code: 'fever', label: 'Fever' },
  { code: 'headache', label: 'Headache' },
  { code: 'neck_stiffness', label: 'Neck stiffness' },
  { code: 'photophobia', label: 'Light sensitivity' },
  { code: 'rash_non_blanching', label: 'Rash that does not fade when pressed' },
  { code: 'vomiting', label: 'Vomiting' },
  { code: 'diarrhoea', label: 'Diarrhoea' },
  { code: 'cough', label: 'Cough' },
  { code: 'sore_throat', label: 'Sore throat' },
  { code: 'fatigue', label: 'Fatigue' },

  /* ── general ── */
  { code: 'runny_nose', label: 'Runny nose or cold' },
  { code: 'congestion', label: 'Congestion' },
  { code: 'sneezing', label: 'Sneezing' },
  { code: 'body_ache', label: 'Body ache' },
  { code: 'dizziness', label: 'Dizziness' },
  { code: 'insomnia', label: 'Trouble sleeping' },

  /* ── digestive ── */
  { code: 'nausea', label: 'Nausea' },
  { code: 'stomach_ache', label: 'Stomach ache' },
  { code: 'constipation', label: 'Constipation' },
  { code: 'acidity', label: 'Acidity or heartburn' },
  { code: 'gas', label: 'Bloating or gas' },

  /* ── musculoskeletal ── */
  { code: 'joint_pain', label: 'Joint pain' },
  { code: 'muscle_cramp', label: 'Muscle cramp' },
  { code: 'back_pain', label: 'Back pain' },

  /* ── skin ── */
  { code: 'skin_rash', label: 'Skin rash' },
  { code: 'itching', label: 'Itching' },
];
