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

/** One side of the pair, as the label audit returns it. */
export interface AgentProfile {
  /** Active ingredient and dose, e.g. "Paracetamol 500 mg". */
  readonly active: string;
  readonly binders: string;
  readonly coatings: string;
  readonly additives: string;
}

export interface MedicineCheck {
  readonly compatibilityVerdict: string;
  readonly riskLevel: string;
  readonly riskPercentage: number;
  readonly dangerDetected: boolean;
  readonly conflictFlags: readonly string[];
  /** The mechanism: what the two do to each other. */
  readonly interactionCause: string;
  /** The longer clinical reading, with the model's analogy. */
  readonly explanation: string;
  /** What to actually do about it. */
  readonly patientAdvice: string;
  /** The enzyme or route involved, e.g. "CYP2E1 oxidation". */
  readonly metabolicPathway: string;
  readonly agentA: AgentProfile | null;
  readonly agentB: AgentProfile | null;
  readonly safeAlternatives: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Field names are the server's, not ours.
 *
 * This asked for `med1` and `med2`, which the route does not read. It replies
 * 400 "Input Fault: Requires Dual Medicine String Maps" before the model is
 * ever called, and the app renders that as "the analysis service could not be
 * reached" - so a naming mismatch looked exactly like the service being down.
 */
export interface MedicineCheckRequest {
  readonly primaryMedicine: string;
  readonly secondaryMedicine: string;
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
 * The same four states, worded for the report analyzer.
 *
 * Like the collision check, this screen has no local result to fall back on -
 * the document is read by the hosted models or it is not read at all - so
 * REMOTE_NOTICE's promise of "your on-device result above" is simply untrue
 * here, and it was appearing directly under a failed upload.
 */
/**
 * Said instead when the reading service is merely busy.
 *
 * Gemini answers 503 "this model is currently experiencing high demand" when
 * it has queued the request away, and the app rendered that as "The report
 * could not be read", which points the blame at the document. Nothing is wrong
 * with the document, and the next attempt usually works.
 */
export const BUSY_NOTICE = 'The reading service is busy right now. Nothing was read - try again in a moment.';

/** True for the transient overload and rate-limit cases, which are worth retrying. */
export function isBusy(detail: string | undefined): boolean {
  if (!detail) return false;
  return /\b503\b|high demand|overload|quota|rate limit|too many requests|unavailable/i.test(detail);
}

export const REPORT_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to have a report read.',
  UNAVAILABLE: 'Reading a report needs a connection. Nothing was read.',
  TIMEOUT: 'The report took too long to read. Nothing was read - try again, or try a smaller file.',
  FAILED: 'The report could not be read. Nothing was read - try again.',
};

/**
 * The same four states, worded for the collision check.
 *
 * REMOTE_NOTICE ends every string with "Your on-device result above is
 * complete", which is true on the triage screen and false here: the collision
 * check is the only check this tab runs, and when it fails there is no local
 * result sitting above it to fall back on. Saying otherwise told someone their
 * medicines had been checked when they had not been, which is the one thing a
 * failure message on this screen must never do.
 */
export const COLLISION_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to run the collision check.',
  UNAVAILABLE: 'The collision check needs a connection. Nothing was checked.',
  TIMEOUT: 'The check did not finish in time. Nothing was checked - try again.',
  FAILED: 'The check could not be completed. Nothing was checked - try again.',
};

/**
 * The same four states, worded for the dashboard.
 *
 * REMOTE_NOTICE was written for the triage result screen and every string ends
 * "Your on-device result above is complete" - which is true there and
 * nonsense on Home, where there is no on-device result and nothing above it.
 * Reusing it put a reassurance about triage under a card about a daily tip.
 */
export const BRIEFING_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to see your daily briefing.',
  UNAVAILABLE: "Today's briefing needs a connection.",
  TIMEOUT: "Today's briefing is taking longer than usual. Pull down to try again.",
  FAILED: "Today's briefing could not be loaded.",
};

/**
 * The remote matrix ranks by probability. The device decides the band. This
 * function is the seam that stops the former overriding the latter - it can
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

/** One leg of the two-stage vision pipeline. */
export interface ReportStage {
  readonly stage: string;
  readonly model: string;
  readonly seconds: number | null;
}

export interface ReportAnalysis {
  readonly documentType: string;
  readonly patientIdentity: string;
  readonly findings: string;
  readonly abnormalMarkers: readonly string[];
  readonly implications: string;
  /** Free text: a short preamble, then numbered steps on their own lines. */
  readonly advice: string;
  readonly riskLevel: ReportRisk;
  /**
   * Which models read the document, and how long each took.
   *
   * Extraction runs on Gemini 2.5 Flash and synthesis on Gemini 3; the reader
   * of a clinical summary is entitled to know that it came from a model and
   * which one, so this is rendered rather than logged.
   */
  readonly stages: readonly ReportStage[];
  readonly totalSeconds: number | null;
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

/* ─────────────────────────── dashboard intelligence ─────────────────────── */

/**
 * The AI briefing from GET /api/dashboard/intel.
 *
 * Generated by Groq from the signed-in person's profile - BMI, conditions -
 * and cached server-side for thirty minutes, which is why the wording changes
 * between sessions rather than on every open.
 *
 * It is model output about someone's health, so the UI must frame it as such.
 * It is not a diagnosis, it has not been reviewed by anyone, and the screen
 * that shows it says so.
 */
export type DailyStatus = 'Optimal' | 'Caution' | 'Alert' | 'Unknown';
export type RiskTrend = 'Stable' | 'Rising' | 'Falling' | 'Unknown';

export interface DigitalTwin {
  readonly pattern: string;
  readonly riskTrend: RiskTrend;
  readonly medInsight: string;
}

export interface Intelligence {
  readonly dailyTip: string;
  readonly dailyStatus: DailyStatus;
  readonly intelligenceBrief: string;
  readonly digitalTwin: DigitalTwin;
  /** Commentary on the environment's effect on this person's profile. */
  readonly environmentalAnalysis: string;
  /** Which model produced it, and how long it took. Shown, not hidden. */
  readonly model: string | null;
  /**
   * Seconds, not milliseconds.
   *
   * groqService computes `(Date.now() - startTime) / 1000`, so the wire value
   * is already in seconds. This was named `generationMs` and divided by 1000
   * again at render - a 2.5s generation displayed as "0.0s". The unit is in
   * the name now so the next reader cannot make the same assumption.
   */
  readonly generationSeconds: number | null;
}

export interface DashboardService {
  /** `fresh` bypasses the server's cache, for a new tip on each app open. */
  intel(fresh?: boolean): Promise<RemoteOutcome<Intelligence>>;
}

/* ───────────────────────────── environment ──────────────────────────────── */

/**
 * Real conditions at the device's location.
 *
 * Deliberately not sourced from the backend: `/api/dashboard/intel` returns a
 * hard-coded `{ aqi: 38, uv: 5, humidity: 62 }` marked "static fallback" in
 * the route, and rendering those as local readings would be inventing a
 * measurement. This port is backed by a real forecast API instead, and every
 * field is nullable so a partial response degrades to "-" rather than to a
 * plausible-looking number.
 */
export interface Conditions {
  readonly uvIndex: number | null;
  readonly aqi: number | null;
  readonly humidity: number | null;
  /** Coordinates the reading is for, so the UI can say where it applies. */
  readonly lat: number;
  readonly lon: number;
  /**
   * Where the coordinates came from.
   *
   * 'device' is a position from the phone; 'network' is city-level, resolved
   * from the connection when no device position was available. The card says
   * which, because "conditions near you" means something different in each
   * case and the reader should not have to guess.
   */
  readonly source: 'device' | 'network' | 'timezone';
  /** City name, when the fix came from the time zone. */
  readonly place: string | null;
}

export type LocationState = 'OK' | 'DENIED' | 'UNAVAILABLE';

export interface ConditionsService {
  /** Resolves location then fetches. DENIED when permission is refused. */
  current(): Promise<{ state: LocationState; data: Conditions | null; notice: string | null }>;
}

/* ───────────────────────────────  profile  ─────────────────────────────── */

/**
 * The parts of the account the checker needs.
 *
 * Age is here rather than asked on the triage screen. It is a fact about the
 * person, not about this episode, so making them re-pick it every time was
 * both friction and a chance to get it wrong - and the answer drives real
 * red-flag rules (a fever at 70 is not a fever at 30).
 */
export interface UserProfile {
  /** Years. Null when the profile has never recorded one. */
  readonly age: number | null;
}

export interface ProfileService {
  me(): Promise<RemoteOutcome<UserProfile>>;
}
