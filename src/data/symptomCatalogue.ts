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
  { code: 'runny_nose', label: 'Runny nose' },
];
