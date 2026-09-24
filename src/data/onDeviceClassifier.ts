/**
 * Model 1 - the on-device classifier, and the seam the whole architecture
 * exists to protect (QR4 / L1).
 *
 * ── Current state, stated plainly ────────────────────────────────────────────
 *
 * There is no trained .tflite artefact yet, and no TFLite runtime is installed.
 * So this file does NOT pretend to run a model. What it does is make the swap a
 * configuration change rather than a code change:
 *
 *   - `ModelBackend` is the narrow surface a real TFLite delegate must satisfy.
 *   - `createOnDeviceClassifier()` asks the backend whether a model is loaded.
 *     If it is, the model scores the episode. If it is not, the deterministic
 *     RuleClassifier scores it instead.
 *   - Either way the returned Classifier reports its own `id` truthfully, so
 *     TriageResult.source records which model actually produced the number.
 *
 * That last point matters more than it looks. Reporting ON_DEVICE_MODEL while
 * a rules engine did the work would corrupt criterion E2 - the latency
 * benchmark would be measuring the wrong thing and nobody would know.
 */
import { SymptomEpisode } from '../domain/entities';
import { Classifier, Classification } from '../domain/ports';
import { RuleClassifier } from './ruleClassifier';

/** What a real TFLite delegate has to provide. Deliberately tiny. */
export interface ModelBackend {
  /** Stable identifier, e.g. 'tflite-v1'. Flows into TriageResult.source. */
  readonly id: string;
  /** False until a quantised model is bundled and the runtime is present. */
  isAvailable(): boolean;
  /** Ordered symptom-severity vector in, severity 0..100 and confidence out. */
  infer(features: readonly number[]): Promise<{ severity: number; confidence: number }>;
}

/**
 * The backend that will wrap react-native-fast-tflite (or the NNAPI delegate)
 * once a model exists. It reports unavailable rather than throwing, because an
 * absent model is an expected state during Phase 4, not a fault.
 */
export class TFLiteBackend implements ModelBackend {
  readonly id = 'tflite-v1';
  constructor(private readonly loaded: boolean = false) {}
  isAvailable(): boolean { return this.loaded; }
  async infer(): Promise<{ severity: number; confidence: number }> {
    throw new Error('TFLiteBackend.infer called with no model loaded');
  }
}

/**
 * Feature vector for the model. Fixed order - the model is trained against
 * these positions, so this array must never be reordered casually.
 */
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

/** Wraps a live model backend as a domain Classifier. */
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

/**
 * Chooses the classifier. Falls back rather than failing: triage must work with
 * no model, no network and no account (QR2).
 */
export function createOnDeviceClassifier(backend: ModelBackend = new TFLiteBackend()): Classifier {
  return backend.isAvailable() ? new ModelClassifier(backend) : new RuleClassifier();
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}
