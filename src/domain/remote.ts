import { TriageBand } from './entities';

export type RemoteStatus =
  | 'OK'
  | 'UNAUTHENTICATED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'FAILED';

export interface RemoteOutcome<T> {
  readonly status: RemoteStatus;
  readonly data: T | null;

  readonly notice: string | null;
  readonly elapsedMs: number;
}

export type MatrixSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ProbableCondition {
  readonly name: string;
  readonly confidence: number;
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

  readonly isEmergencyOverride: boolean;
}

export interface SymptomAnalysisRequest {
  readonly activeSymptoms: readonly string[];
  readonly customSymptom: string;
}

export interface AgentProfile {
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

  readonly interactionCause: string;

  readonly explanation: string;

  readonly patientAdvice: string;

  readonly metabolicPathway: string;
  readonly agentA: AgentProfile | null;
  readonly agentB: AgentProfile | null;
  readonly safeAlternatives: readonly string[];
  readonly warnings: readonly string[];
}

export interface MedicineCheckRequest {
  readonly primaryMedicine: string;
  readonly secondaryMedicine: string;
}

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

export const BUSY_NOTICE = 'The reading service is busy right now. Nothing was read - try again in a moment.';

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

export const COLLISION_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to run the collision check.',
  UNAVAILABLE: 'The collision check needs a connection. Nothing was checked.',
  TIMEOUT: 'The check did not finish in time. Nothing was checked - try again.',
  FAILED: 'The check could not be completed. Nothing was checked - try again.',
};

export const BRIEFING_NOTICE: Record<Exclude<RemoteStatus, 'OK'>, string> = {
  UNAUTHENTICATED: 'Sign in to see your daily briefing.',
  UNAVAILABLE: "Today's briefing needs a connection.",
  TIMEOUT: "Today's briefing is taking longer than usual. Pull down to try again.",
  FAILED: "Today's briefing could not be loaded.",
};

export function combineWithRemote(deviceBand: TriageBand, remote: SymptomAnalysis | null): TriageBand {
  if (!remote) return deviceBand;
  return remote.isEmergencyOverride ? 'EMERGENCY' : deviceBand;
}

export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;

  readonly id: string;
}

export interface ChatGreeting {
  readonly greeting: string;
  readonly suggestions: readonly string[];
}

export interface ChatReply {
  readonly sessionId: string;
  readonly reply: string;
}

export interface ChatService {
  greeting(): Promise<RemoteOutcome<ChatGreeting>>;
  send(message: string, sessionId: string | null): Promise<RemoteOutcome<ChatReply>>;
}

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

  readonly briefing: string;
}

export interface NewsService {
  feed(): Promise<RemoteOutcome<NewsFeed>>;
}

export type ReportRisk = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

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

  readonly advice: string;
  readonly riskLevel: ReportRisk;

  readonly stages: readonly ReportStage[];
  readonly totalSeconds: number | null;
}

export interface UploadFile {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface ReportService {
  analyze(file: UploadFile): Promise<RemoteOutcome<ReportAnalysis>>;
}

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

  readonly environmentalAnalysis: string;

  readonly model: string | null;

  readonly generationSeconds: number | null;
}

export interface DashboardService {
  intel(fresh?: boolean): Promise<RemoteOutcome<Intelligence>>;
}

export interface Conditions {
  readonly uvIndex: number | null;
  readonly aqi: number | null;
  readonly humidity: number | null;

  readonly lat: number;
  readonly lon: number;

  readonly source: 'device' | 'network' | 'timezone';

  readonly place: string | null;
}

export type LocationState = 'OK' | 'DENIED' | 'UNAVAILABLE';

export interface ConditionsService {
  current(): Promise<{ state: LocationState; data: Conditions | null; notice: string | null }>;
}

export interface UserProfile {
  readonly fullName: string | null;

  readonly age: number | null;
  readonly gender: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;

  readonly bloodGroup: string | null;

  readonly allergies: readonly string[];
  readonly conditions: readonly string[];
  readonly medications: readonly string[];

  readonly bmi: number | null;
}

export type ProfileEdits = Omit<UserProfile, 'bmi'>;

export interface ProfileService {
  me(): Promise<RemoteOutcome<UserProfile>>;
  save(edits: ProfileEdits): Promise<RemoteOutcome<UserProfile>>;
}
