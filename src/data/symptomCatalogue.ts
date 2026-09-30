import { Symptom } from '../domain/entities';

export const CATALOGUE: readonly Omit<Symptom, 'severity'>[] = [

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

  { code: 'runny_nose', label: 'Runny nose or cold' },
  { code: 'congestion', label: 'Congestion' },
  { code: 'sneezing', label: 'Sneezing' },
  { code: 'body_ache', label: 'Body ache' },
  { code: 'dizziness', label: 'Dizziness' },
  { code: 'insomnia', label: 'Trouble sleeping' },

  { code: 'nausea', label: 'Nausea' },
  { code: 'stomach_ache', label: 'Stomach ache' },
  { code: 'constipation', label: 'Constipation' },
  { code: 'acidity', label: 'Acidity or heartburn' },
  { code: 'gas', label: 'Bloating or gas' },

  { code: 'joint_pain', label: 'Joint pain' },
  { code: 'muscle_cramp', label: 'Muscle cramp' },
  { code: 'back_pain', label: 'Back pain' },

  { code: 'skin_rash', label: 'Skin rash' },
  { code: 'itching', label: 'Itching' },
];
