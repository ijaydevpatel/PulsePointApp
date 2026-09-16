/**
 * The two hosted models, as the backend actually exposes them.
 *
 *   POST /api/symptoms/analyze   -> Groq (qwen3-32b) diagnostic matrix
 *   POST /api/medicine/check     -> Groq compatibility audit
 *
 * Both are Clerk-protected. Both hold their provider keys server-side, which is
 * requirement P3: the app carries only the public API URL and a user token.
 *
 * This file imports NOTHING outside the domain (L2). Transport lives in data/.
 *
 * ── Why every call returns a state rather than throwing ──────────────────────
 *
 * The web app rendered "Awaiting Synchronization" forever when a call failed,
 * and a stalled panel reads as an answer. So there is no optional success here:
 * each call resolves to exactly one of five states, and four of them carry a
 * notice the UI is obliged to render. There is no representable value meaning
 * "nothing happened".
 */
import { TriageBand } from './entities';

export type RemoteStatus =
  | 'OK'
  | 'UNAUTHENTICATED'   // no Clerk token; these routes are `protect`ed
  | 'UNAVAILABLE'       // no API URL configured, or the device is offline
  | 'TIMEOUT'
  | 'FAILED';

export interface RemoteOutcome<T> {
  readonly status: RemoteStatus;
  readonly data: T | null;
  /** Populated whenever status is not OK. Never both null. */
  readonly notice: string | null;
  readonly elapsedMs: number;
}

/* ───────────────────────── symptoms/analyze ───────────────────────── */

export type MatrixSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ProbableCondition {
  readonly name: string;
  readonly confidence: number;   // 0..100
  readonly severity: MatrixSeverity;
}

export interface TreatmentPathways {
  readonly allopathy: readonly string[];
  readonly homeopathic: readonly string[];
  readonly homeRemedies: readonly string[];
}

export interface SymptomAnalysis {
  readonly probabilityMatrix: readonly ProbableCondition[];
  readonly treatmentPathways: TreatmentPathways;
  readonly summaryText: string;
  /** True when the backend's own rule engine short-circuited before the model. */
  readonly isEmergencyOverride: boolean;
}

export interface SymptomAnalysisRequest {
  readonly activeSymptoms: readonly string[];
  readonly customSymptom: string;
}

/* ────────────────────────── medicine/check ────────────────────────── */

export interface MedicineCheck {
  readonly compatibilityVerdict: string;
  readonly riskLevel: string;
  readonly riskPercentage: number;
  readonly dangerDetected: boolean;
  readonly conflictFlags: readonly string[];
  readonly explanation: string;
  readonly safeAlternatives: readonly string[];
  readonly warnings: readonly string[];
}

export interface MedicineCheckRequest {
  readonly med1: string;
  readonly med2: string;
}

/* ──────────────────────────── the ports ───────────────────────────── */

export interface SymptomAnalysisService {
  analyze(r: SymptomAnalysisRequest): Promise<RemoteOutcome<SymptomAnalysis>>;
}

export interface MedicineCheckService {
  check(r: MedicineCheckRequest): Promise<RemoteOutcome<MedicineCheck>>;
}

export const REMOTE_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to use the online analysis. Your on-device result above is complete.',
  UNAVAILABLE: 'Online analysis is unavailable offline. Your on-device result above is complete.',
  TIMEOUT: 'The analysis service did not respond in time. Your on-device result above is complete.',
  FAILED: 'The analysis service could not be reached. Your on-device result above is complete.',
};

/**
 * The remote matrix ranks by probability. The device decides the band. This
 * function is the seam that stops the former overriding the latter — it can
 * only ever raise. Asserted in the tests.
 */
export function combineWithRemote(deviceBand: TriageBand, remote: SymptomAnalysis | null): TriageBand {
  if (!remote) return deviceBand;
  return remote.isEmergencyOverride ? 'EMERGENCY' : deviceBand;
}

/* ═══════════════════════ chat · GET /greeting, POST /message ═══════════════ */

export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
  /** Local id so the list has a stable key before the server replies. */
  readonly id: string;
}

export interface ChatGreeting {
  readonly greeting: string;
  readonly suggestions: readonly string[];
}

export interface ChatReply {
  /** Returned by the server on the first turn; sent back on every turn after. */
  readonly sessionId: string;
  readonly reply: string;
}

export interface ChatService {
  greeting(): Promise<RemoteOutcome<ChatGreeting>>;
  send(message: string, sessionId: string | null): Promise<RemoteOutcome<ChatReply>>;
}

/* ═════════════════════════════ news · GET /api/news ════════════════════════ */

export interface NewsItem {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly source: string;
  readonly date: string;
  readonly link: string;
  readonly image: string;
  readonly category: string;
}

export interface NewsFeed {
  readonly news: readonly NewsItem[];
  /** One-line synthesis the backend derives from the top brief. */
  readonly briefing: string;
}

export interface NewsService {
  feed(): Promise<RemoteOutcome<NewsFeed>>;
}

/* ══════════════════ analyzer · POST /api/reports/analyze ═══════════════════ */

export type ReportRisk = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export interface ReportAnalysis {
  readonly documentType: string;
  readonly patientIdentity: string;
  readonly findings: string;
  readonly abnormalMarkers: readonly string[];
  readonly implications: string;
  readonly advice: string;
  readonly riskLevel: ReportRisk;
}

/** A file chosen on the device, in the shape React Native's FormData wants. */
export interface UploadFile {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface ReportService {
  analyze(file: UploadFile): Promise<RemoteOutcome<ReportAnalysis>>;
}
