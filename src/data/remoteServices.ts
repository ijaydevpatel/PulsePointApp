/**
 * The two hosted models, wired to the endpoints the backend actually exposes.
 *
 * Neither service throws. Each maps every failure onto a RemoteOutcome state
 * so the UI always has something honest to render (R2 / QR2).
 */
import {
  AgentProfile, MedicineCheck, MedicineCheckRequest, MedicineCheckService,
  RemoteOutcome, RemoteStatus, REMOTE_NOTICE, COLLISION_NOTICE,
  SymptomAnalysis, SymptomAnalysisRequest, SymptomAnalysisService,
  ProbableCondition, MatrixSeverity,
  DailyStatus, DashboardService, Intelligence, RiskTrend,
  ReportStage,
  ProfileService, UserProfile,
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

/**
 * @param notices Wording for the caller's screen. Defaults to the triage
 *   phrasing, which promises an on-device result above the message - true
 *   there, and false anywhere that has no local fallback.
 */
function fail<T>(
  status: Failure,
  started: number,
  notices: Record<Failure, string> = REMOTE_NOTICE,
): RemoteOutcome<T> {
  return { status, data: null, notice: notices[status], elapsedMs: Date.now() - started };
}

/* ─────────────────────── POST /api/symptoms/analyze ─────────────────────── */

/**
 * How long the diagnostic matrix is allowed to take.
 *
 * The default thirty seconds was why this section never appeared: the request
 * asks a 120B model for five ranked conditions, three treatment pathways and a
 * written synopsis, which does not finish in thirty seconds. The app aborted
 * and rendered "did not respond in time" while the server went on to produce a
 * perfectly good answer that nothing was left to receive.
 *
 * Ninety seconds is chosen against the server, not guessed: Render's own
 * request ceiling is shorter than this, so a genuinely stuck call still ends -
 * this only stops the client giving up first.
 */
const ANALYSIS_TIMEOUT_MS = 90000;

/**
 * How many sentences of synopsis the result screen will show.
 *
 * The server prompt asks for four or five in two separate places and the model
 * returns seven or eight anyway. A prompt is a request; this is the constraint.
 * See domain/sentences.ts for why cutting this text is safe - in short, the
 * escalation on that screen is decided on the device and does not read this
 * string.
 */
const SYNOPSIS_SENTENCES = 5;

/**
 * The collision check's prose, per block.
 *
 * Four rather than the synopsis's five because this screen carries three of
 * them - mechanism, rationale, advice - and the server prompt asks the model
 * for "6-8 sentence exhaustive deep-dive" on one of them alone. Unchecked,
 * that is a wall of text on a phone.
 */
const COLLISION_SENTENCES = 4;

/** One side of the label audit, or null when the model omitted it. */
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

/** Trim and cap a prose field, tolerating a missing one. */
const prose = (v: unknown): string =>
  (typeof v === 'string' ? limitSentences(v, COLLISION_SENTENCES) : '');

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
      // Also a model generation, so also past the default. See the note on
      // ANALYSIS_TIMEOUT_MS.
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

          /*
           * Every prose field is capped. The model is asked for an exhaustive
           * deep-dive and delivers one; the flags, warnings and alternatives
           * are separate list fields and are untouched, so nothing cautionary
           * depends on the shortened text.
           */
          interactionCause: prose(raw?.interactionCause),
          explanation: prose(raw?.explanation),
          patientAdvice: prose(raw?.patientAdvice),

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

/** Defensive: the pipeline's shape is set by the backend, not guaranteed. */
function readStages(v: unknown): ReportStage[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x: any) => {
    const model = typeof x?.model === 'string' ? x.model.trim() : '';
    if (!model) return [];
    return [{
      stage: typeof x?.stage === 'string' ? x.stage : '',
      model,
      seconds: typeof x?.seconds === 'number' && Number.isFinite(x.seconds) ? x.seconds : null,
    }];
  });
}

export class RemoteReportAnalyzer implements ReportService {
  constructor(private readonly api: ApiClient) {}

  async analyze(file: UploadFile): Promise<RemoteOutcome<ReportAnalysis>> {
    const started = Date.now();
    try {
      // The route is upload.single('reportFile'), so the field name is not
      // negotiable - a mismatch surfaces as "No file uploaded" from multer.
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
          stages: readStages(raw?.neuralPulse?.stages),
          totalSeconds: typeof raw?.neuralPulse?.generationTime === 'number'
            ? raw.neuralPulse.generationTime
            : null,
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


/* ─────────────────────────── dashboard intelligence ─────────────────────── */

/** Only the three values the route's prompt asks for; anything else is noise. */
function readStatus(v: unknown): DailyStatus {
  return v === 'Optimal' || v === 'Caution' || v === 'Alert' ? v : 'Unknown';
}

function readTrend(v: unknown): RiskTrend {
  return v === 'Stable' || v === 'Rising' || v === 'Falling' ? v : 'Unknown';
}

/** Trim-or-empty. Distinct from the two-argument `str` above, which defaults. */
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * GET /api/dashboard/intel.
 *
 * The route asks Groq for strict JSON and extracts it with a regex, so the
 * shape that arrives is whatever the model produced that round. Every field is
 * therefore read defensively: an unexpected enum becomes 'Unknown' rather than
 * being passed through to a UI that would style it as though it were valid.
 *
 * A response with no tip and no brief is treated as a failure. An empty card
 * that looks like it loaded is worse than one that admits it did not.
 */
export class RemoteDashboard implements DashboardService {
  constructor(private readonly api: ApiClient) {}

  /**
   * @param fresh Skip the server's 30-minute cache.
   *
   * Home passes true on every open. The tip is meant to be a new piece of
   * guidance each time the app is launched, and the cache made it the same
   * sentence all afternoon. The server still writes the cache, so a failed
   * regeneration falls back to the last good tip rather than to nothing.
   */
  async intel(fresh = false): Promise<RemoteOutcome<Intelligence>> {
    const started = Date.now();
    try {
      /*
       * A forced regeneration gets 75s.
       *
       * ?fresh=1 skips the server cache, so the request waits on a full model
       * generation - and on a free dyno that may also include a cold start.
       * The shared 30s default was fine for a cached read and guaranteed a
       * timeout for this one. Nothing on Home blocks on it: the card paints
       * from cache first and this replaces it when it lands.
       */
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


/* ───────────────────────────────  profile  ─────────────────────────────── */

/**
 * GET /api/profile.
 *
 * The backend defaults `age` to 0 for a profile that has never set one, so a
 * zero is read as "unknown" rather than as a newborn - which would otherwise
 * put every account with an empty profile into the child red-flag rules.
 */
export class RemoteProfile implements ProfileService {
  constructor(private readonly api: ApiClient) {}

  async me(): Promise<RemoteOutcome<UserProfile>> {
    const started = Date.now();
    try {
      const raw = await this.api.get<any>('/api/profile');
      const age = raw?.age;
      const usable = typeof age === 'number' && Number.isFinite(age) && age > 0 && age < 120;

      return {
        status: 'OK',
        data: { age: usable ? Math.round(age) : null },
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      return fail(classify(error, this.api.configured), started);
    }
  }
}
