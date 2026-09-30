import { SymptomEpisode } from '../domain/entities';
import { Classifier, Classification } from '../domain/ports';
import { RuleClassifier } from './ruleClassifier';

export interface ModelBackend {
  readonly id: string;

  isAvailable(): boolean;

  infer(features: readonly number[]): Promise<{ severity: number; confidence: number }>;
}

export class TFLiteBackend implements ModelBackend {
  readonly id = 'tflite-v1';
  constructor(private readonly loaded: boolean = false) {}
  isAvailable(): boolean { return this.loaded; }
  async infer(): Promise<{ severity: number; confidence: number }> {
    throw new Error('TFLiteBackend.infer called with no model loaded');
  }
}

export const FEATURE_CODES: readonly string[] = [
  'facial_droop', 'arm_weakness', 'speech_difficulty', 'chest_pain',
  'breathlessness', 'rash_non_blanching', 'confusion', 'neck_stiffness',
  'radiating_pain', 'fever', 'photophobia', 'vomiting', 'headache',
  'diarrhoea', 'cough', 'sore_throat', 'fatigue', 'runny_nose',
];

export function toFeatureVector(episode: SymptomEpisode): readonly number[] {
  return FEATURE_CODES.map((code) => {
    const hit = episode.symptoms.find((s) => s.code === code);
    return hit ? hit.severity / 10 : 0;
  });
}

class ModelClassifier implements Classifier {
  readonly id: string;
  constructor(private readonly backend: ModelBackend) { this.id = backend.id; }

  async classify(episode: SymptomEpisode): Promise<Classification> {
    const { severity, confidence } = await this.backend.infer(toFeatureVector(episode));
    return {
      severity: clamp(severity, 0, 100),
      confidence: clamp(confidence, 0, 1),
      rationale: [`Scored on device by ${this.id}.`],
    };
  }
}

export function createOnDeviceClassifier(backend: ModelBackend = new TFLiteBackend()): Classifier {
  return backend.isAvailable() ? new ModelClassifier(backend) : new RuleClassifier();
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}
