import {
  AgentProfile, MedicineCheck, MedicineCheckRequest, MedicineCheckService,
  RemoteOutcome, RemoteStatus, REMOTE_NOTICE, COLLISION_NOTICE,
  BUSY_NOTICE, isBusy,
  SymptomAnalysis, SymptomAnalysisRequest, SymptomAnalysisService,
  ProbableCondition, MatrixSeverity,
  DailyStatus, DashboardService, Intelligence, RiskTrend,
  ProfileService, UserProfile, ProfileEdits,
} from '../domain/remote';
import { limitSentences } from '../domain/sentences';
import { ApiClient, ApiError } from './apiClient';

const SEVERITIES: readonly MatrixSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

type Failure = Exclude<RemoteStatus, 'OK'>;

function classify(error: unknown, configured: boolean): Failure {
  if (error instanceof Error && error.name === 'AbortError') return 'TIMEOUT';
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'UNAUTHENTICATED';
    if (error.status === 0) return 'UNAVAILABLE';
    return 'FAILED';
  }
  return configured ? 'FAILED' : 'UNAVAILABLE';
}

function fail<T>(
  status: Failure,
  started: number,
  notices: Record<Failure, string> = REMOTE_NOTICE,
  detail?: string,
): RemoteOutcome<T> {
  const notice = detail ? `${notices[status]} (${detail})` : notices[status];
  return { status, data: null, notice, elapsedMs: Date.now() - started };
}

function serverDetail(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) {
    if (!(error instanceof Error) || error.name === 'AbortError') return undefined;
    const message = error.message.trim();
    return message ? message.slice(0, 120) : undefined;
  }

  if (error.isHtml) return `HTTP ${error.status}, not JSON`;
  const message = error.message.trim();
  if (!message || message === 'Request failed' || message === 'Upload failed') {
    return `HTTP ${error.status}`;
  }
  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

const ANALYSIS_TIMEOUT_MS = 90000;

const SYNOPSIS_SENTENCES = 5;

const ADVICE_SENTENCES = 4;
const REASON_SENTENCES = 3;

function agentProfile(raw: any): AgentProfile | null {
  const active = typeof raw?.active === 'string' ? raw.active.trim() : '';
  if (!active) return null;

  const inactive = raw?.inactive ?? {};
  const field = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  return {
    active,
    binders: field(inactive.binders),
    coatings: field(inactive.coatings),
    additives: field(inactive.additives),
  };
}

const prose = (v: unknown, max: number): string =>
  (typeof v === 'string' ? limitSentences(v, max) : '');

export class RemoteSymptomAnalysis implements SymptomAnalysisService {
  constructor(private readonly api: ApiClient) {}

  async analyze(request: SymptomAnalysisRequest): Promise<RemoteOutcome<SymptomAnalysis>> {
    const started = Date.now();
    try {
      const raw = await this.api.post<any>('/api/symptoms/analyze', {
        activeSymptoms: request.activeSymptoms,
        customSymptom: request.customSymptom,
      }, ANALYSIS_TIMEOUT_MS);

      const matrix = readMatrix(raw?.probabilityMatrix);
      const summary = typeof raw?.summaryText === 'string'
        ? limitSentences(raw.summaryText, SYNOPSIS_SENTENCES)
        : '';

      if (matrix.length === 0 && summary.length === 0) return fail('FAILED', started);

      return {
        status: 'OK',
        data: {
          probabilityMatrix: matrix,
          treatmentPathways: {
            allopathy: strings(raw?.treatmentPathways?.allopathy),
            homeopathic: strings(raw?.treatmentPathways?.homeopathic),
            homeRemedies: strings(raw?.treatmentPathways?.homeRemedies),
          },
          summaryText: summary,
          isEmergencyOverride: raw?.isEmergencyOverride === true,
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

export class RemoteMedicineCheck implements MedicineCheckService {
  constructor(private readonly api: ApiClient) {}

  async check(request: MedicineCheckRequest): Promise<RemoteOutcome<MedicineCheck>> {
    const started = Date.now();
    try {
      const raw = await this.api.post<any>('/api/medicine/check', {
        primaryMedicine: request.primaryMedicine,
        secondaryMedicine: request.secondaryMedicine,
      }, ANALYSIS_TIMEOUT_MS);

      const verdict = typeof raw?.compatibilityVerdict === 'string'
        ? raw.compatibilityVerdict.trim() : '';
      if (!verdict) return fail('FAILED', started, COLLISION_NOTICE);

      return {
        status: 'OK',
        data: {
          compatibilityVerdict: verdict,
          riskLevel: typeof raw?.riskLevel === 'string' ? raw.riskLevel : 'Unknown',
          riskPercentage: num(raw?.riskPercentage, 0, 100),
          dangerDetected: raw?.dangerDetected === true,
          conflictFlags: strings(raw?.conflictFlags),

          interactionCause: prose(raw?.interactionCause, REASON_SENTENCES),
          explanation: prose(raw?.explanation, REASON_SENTENCES),
          patientAdvice: prose(raw?.patientAdvice, ADVICE_SENTENCES),

          metabolicPathway: typeof raw?.metabolicPathway === 'string'
            ? raw.metabolicPathway.trim() : '',
          agentA: agentProfile(raw?.techIngredients1),
          agentB: agentProfile(raw?.techIngredients2),

          safeAlternatives: strings(raw?.safeAlternatives),
          warnings: strings(raw?.warnings),
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started, COLLISION_NOTICE);
    }
  }
}

function strings(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
}

function num(v: unknown, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

function readMatrix(v: unknown): readonly ProbableCondition[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r) => r && typeof r.name === 'string' && r.name.trim() !== '')
    .map((r) => ({
      name: String(r.name).trim(),
      confidence: num(r.confidence, 0, 100),
      severity: SEVERITIES.includes(r.severity) ? r.severity as MatrixSeverity : 'Low',
    }));
}

import {
  ChatGreeting, ChatReply, ChatService,
  NewsFeed, NewsItem, NewsService,
} from '../domain/remote';

export class RemoteChat implements ChatService {
  constructor(private readonly api: ApiClient) {}

  async greeting(): Promise<RemoteOutcome<ChatGreeting>> {
    const started = Date.now();
    try {
      const raw = await this.api.get<any>('/api/chat/greeting');
      const text = typeof raw?.greeting === 'string' ? raw.greeting.trim() : '';
      if (!text) return fail('FAILED', started);
      return {
        status: 'OK',
        data: { greeting: text, suggestions: strings(raw?.suggestions) },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }

  async send(message: string, sessionId: string | null): Promise<RemoteOutcome<ChatReply>> {
    const started = Date.now();
    try {
      if (!message.trim()) return fail('FAILED', started);

      const raw = await this.api.post<any>('/api/chat/message', {
        message,
        ...(sessionId ? { sessionId } : {}),
      });
      const reply = typeof raw?.reply === 'string' ? raw.reply.trim() : '';
      if (!reply) return fail('FAILED', started);
      return {
        status: 'OK',
        data: { sessionId: String(raw?.sessionId ?? sessionId ?? ''), reply },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

export class RemoteNews implements NewsService {
  constructor(private readonly api: ApiClient) {}

  async feed(): Promise<RemoteOutcome<NewsFeed>> {
    const started = Date.now();
    try {
      const raw = await this.api.get<any>('/api/news');
      const items = readNews(raw?.news);
      if (items.length === 0) return fail('FAILED', started);
      return {
        status: 'OK',
        data: {
          news: items,
          briefing: typeof raw?.neuralBriefing === 'string' ? raw.neuralBriefing : '',
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

function readNews(v: unknown): readonly NewsItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n) => n && typeof n.title === 'string' && n.title.trim() !== '')
    .map((n, i) => ({
      id: typeof n.id === 'string' ? n.id : `news_${i}`,
      title: String(n.title).trim(),
      snippet: typeof n.snippet === 'string' ? n.snippet : '',
      source: typeof n.source === 'string' ? n.source : '',
      date: typeof n.date === 'string' ? n.date : '',
      link: typeof n.link === 'string' ? n.link : '',
      image: typeof n.image === 'string' ? n.image : '',
      category: typeof n.category === 'string' ? n.category : '',
    }));
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}

function readStatus(v: unknown): DailyStatus {
  return v === 'Optimal' || v === 'Caution' || v === 'Alert' ? v : 'Unknown';
}

function readTrend(v: unknown): RiskTrend {
  return v === 'Stable' || v === 'Rising' || v === 'Falling' ? v : 'Unknown';
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export class RemoteDashboard implements DashboardService {
  constructor(private readonly api: ApiClient) {}

  async intel(fresh = false): Promise<RemoteOutcome<Intelligence>> {
    const started = Date.now();
    try {
      const raw = await this.api.get<any>(
        fresh ? '/api/dashboard/intel?fresh=1' : '/api/dashboard/intel',
        fresh ? 75000 : undefined,
      );
      const i = raw?.intelligence ?? {};
      const twin = i?.digitalTwin ?? {};

      const dailyTip = text(i.dailyTip);
      const intelligenceBrief = text(i.intelligenceBrief);
      if (!dailyTip && !intelligenceBrief) return fail('FAILED', started);

      const genMs = raw?.neuralPulse?.generationTime;

      return {
        status: 'OK',
        data: {
          dailyTip,
          dailyStatus: readStatus(i.dailyStatus),
          intelligenceBrief,
          digitalTwin: {
            pattern: text(twin.pattern),
            riskTrend: readTrend(twin.riskTrend),
            medInsight: text(twin.medInsight),
          },
          environmentalAnalysis: text(i.environmentalAnalysis),
          model: text(raw?.neuralPulse?.model) || null,
          generationSeconds: typeof genMs === 'number' && Number.isFinite(genMs) ? genMs : null,
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

function figure(v: unknown, max: number): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n < max ? n : null;
}

function words(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

function list(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : String(v ?? '').split(',');
  return raw.map((s) => String(s).trim()).filter((s) => s !== '');
}

function readProfile(raw: any): UserProfile {
  return {
    fullName: words(raw?.fullName),

    age: (() => { const a = figure(raw?.age, 120); return a === null ? null : Math.round(a); })(),
    gender: words(raw?.gender),
    heightCm: figure(raw?.height, 300),
    weightKg: figure(raw?.weight, 700),
    bloodGroup: words(raw?.bloodGroup),
    allergies: list(raw?.allergies),
    conditions: list(raw?.conditions),
    medications: list(raw?.medications),
    bmi: figure(raw?.bmi, 200),
  };
}

export class RemoteProfile implements ProfileService {
  constructor(private readonly api: ApiClient) {}

  async me(): Promise<RemoteOutcome<UserProfile>> {
    const started = Date.now();
    try {
      return {
        status: 'OK',
        data: readProfile(await this.api.get<any>('/api/profile')),
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }

  async save(edits: ProfileEdits): Promise<RemoteOutcome<UserProfile>> {
    const started = Date.now();
    try {
      const raw = await this.api.post<any>('/api/profile', {
        fullName: edits.fullName ?? '',
        age: edits.age ?? 0,
        gender: edits.gender ?? '',
        height: edits.heightCm ?? 0,
        weight: edits.weightKg ?? 0,
        bloodGroup: edits.bloodGroup ?? '',
        allergies: edits.allergies,
        conditions: edits.conditions,
        medications: edits.medications,
      });

      return {
        status: 'OK',
        data: readProfile(raw),
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}
