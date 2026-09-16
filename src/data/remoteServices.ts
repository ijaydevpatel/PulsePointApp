/**
 * The two hosted models, wired to the endpoints the backend actually exposes.
 *
 * Neither service throws. Each maps every failure onto a RemoteOutcome state
 * so the UI always has something honest to render (R2 / QR2).
 */
import {
  MedicineCheck, MedicineCheckRequest, MedicineCheckService,
  RemoteOutcome, RemoteStatus, REMOTE_NOTICE,
  SymptomAnalysis, SymptomAnalysisRequest, SymptomAnalysisService,
  ProbableCondition, MatrixSeverity,
} from '../domain/remote';
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

function fail<T>(status: Failure, started: number): RemoteOutcome<T> {
  return { status, data: null, notice: REMOTE_NOTICE[status], elapsedMs: Date.now() - started };
}

/* ─────────────────────── POST /api/symptoms/analyze ─────────────────────── */

export class RemoteSymptomAnalysis implements SymptomAnalysisService {
  constructor(private readonly api: ApiClient) {}

  async analyze(request: SymptomAnalysisRequest): Promise<RemoteOutcome<SymptomAnalysis>> {
    const started = Date.now();
    try {
      const raw = await this.api.post<any>('/api/symptoms/analyze', {
        activeSymptoms: request.activeSymptoms,
        customSymptom: request.customSymptom,
      });

      const matrix = readMatrix(raw?.probabilityMatrix);
      const summary = typeof raw?.summaryText === 'string' ? raw.summaryText.trim() : '';

      // An empty matrix and an empty summary is the blank panel. Treat it as a
      // failure rather than rendering a successful-looking void.
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

/* ──────────────────────── POST /api/medicine/check ──────────────────────── */

export class RemoteMedicineCheck implements MedicineCheckService {
  constructor(private readonly api: ApiClient) {}

  async check(request: MedicineCheckRequest): Promise<RemoteOutcome<MedicineCheck>> {
    const started = Date.now();
    try {
      const raw = await this.api.post<any>('/api/medicine/check', {
        med1: request.med1, med2: request.med2,
      });

      const verdict = typeof raw?.compatibilityVerdict === 'string'
        ? raw.compatibilityVerdict.trim() : '';
      if (!verdict) return fail('FAILED', started);

      return {
        status: 'OK',
        data: {
          compatibilityVerdict: verdict,
          riskLevel: typeof raw?.riskLevel === 'string' ? raw.riskLevel : 'Unknown',
          riskPercentage: num(raw?.riskPercentage, 0, 100),
          dangerDetected: raw?.dangerDetected === true,
          conflictFlags: strings(raw?.conflictFlags),
          explanation: typeof raw?.explanation === 'string' ? raw.explanation : '',
          safeAlternatives: strings(raw?.safeAlternatives),
          warnings: strings(raw?.warnings),
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

/* ─────────────────────────────── parsing ────────────────────────────────── */

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

/* ═══════════════════════════════ chat ══════════════════════════════════════ */

import {
  ChatGreeting, ChatReply, ChatService,
  NewsFeed, NewsItem, NewsService,
  ReportAnalysis, ReportRisk, ReportService, UploadFile,
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
      // The controller rejects an empty message with 400, so do not spend a
      // round trip discovering that.
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

/* ═══════════════════════════════ news ══════════════════════════════════════ */

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

/* ═════════════════════════════ analyzer ════════════════════════════════════ */

const RISKS: readonly ReportRisk[] = ['Low', 'Moderate', 'High', 'Critical'];

export class RemoteReportAnalyzer implements ReportService {
  constructor(private readonly api: ApiClient) {}

  async analyze(file: UploadFile): Promise<RemoteOutcome<ReportAnalysis>> {
    const started = Date.now();
    try {
      // The route is upload.single('reportFile'), so the field name is not
      // negotiable — a mismatch surfaces as "No file uploaded" from multer.
      const raw = await this.api.upload<any>('/api/reports/analyze', 'reportFile', file);

      const findings = typeof raw?.findings === 'string' ? raw.findings.trim() : '';
      if (!findings) return fail('FAILED', started);

      return {
        status: 'OK',
        data: {
          documentType: str(raw?.documentType, 'Document'),
          patientIdentity: str(raw?.patientIdentity, '[UNKNOWN]'),
          findings,
          abnormalMarkers: strings(raw?.abnormalMarkers),
          implications: str(raw?.implications, ''),
          advice: str(raw?.advice, ''),
          riskLevel: RISKS.includes(raw?.riskLevel) ? raw.riskLevel as ReportRisk : 'Unknown',
        },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}
