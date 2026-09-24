/**
 * The two hosted models, wired to the endpoints the backend actually exposes.
 *
 * Neither service throws. Each maps every failure onto a RemoteOutcome state
 * so the UI always has something honest to render (R2 / QR2).
 */
import {
  AgentProfile, MedicineCheck, MedicineCheckRequest, MedicineCheckService,
  RemoteOutcome, RemoteStatus, REMOTE_NOTICE, COLLISION_NOTICE, REPORT_NOTICE,
  BUSY_NOTICE, isBusy,
  SymptomAnalysis, SymptomAnalysisRequest, SymptomAnalysisService,
  ProbableCondition, MatrixSeverity,
  DailyStatus, DashboardService, Intelligence, RiskTrend,
  ReportStage,
  ProfileService, UserProfile,
} from '../domain/remote';
import { limitSentences } from '../domain/sentences';
import { salvageJson } from '../domain/salvageJson';
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
  detail?: string,
): RemoteOutcome<T> {
  const notice = detail ? `${notices[status]} (${detail})` : notices[status];
  return { status, data: null, notice, elapsedMs: Date.now() - started };
}

/**
 * What the server said, when it said anything worth repeating.
 *
 * Every failure used to collapse into one generic sentence, which made three
 * very different problems - a rejected upload, a model fault, an HTML error
 * page from a cold start - completely indistinguishable on screen and, more
 * to the point, indistinguishable to anyone trying to fix them. The server
 * already returns a reason; throwing it away was the expensive part.
 *
 * Only for ApiError, so a network failure does not surface a stack message,
 * and trimmed, because these are meant to fit under a notice rather than
 * become one.
 */
function serverDetail(error: unknown): string | undefined {
  /*
   * A failure that never reached the server is worth naming too. "Network
   * request failed" and a file the picker handed over as an unreadable URI
   * both land here, and both are otherwise indistinguishable from the server
   * rejecting the upload. AbortError is excluded: that is the timeout, which
   * already has its own state and wording.
   */
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
 * Longer again for a report, because more happens.
 *
 * The file is uploaded, parsed, read by Gemini 2.5 for extraction and then by
 * Gemini 3 for synthesis. That is two model passes over a document rather than
 * one generation from a prompt, and it was being cut off at thirty seconds -
 * the same mistake as the symptom matrix, on the heaviest call in the app.
 */
const REPORT_TIMEOUT_MS = 150000;

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
 * How long each block on the collision screen is allowed to be.
 *
 * Two different limits, because the two blocks do different jobs. The advice
 * is the reason someone opened the screen and every sentence in it is an
 * instruction, so it keeps four. The explanation of why is context: useful,
 * but not worth scrolling past the instruction for, and the server prompt asks
 * the model for a "6-8 sentence exhaustive deep-dive" of it.
 */
const ADVICE_SENTENCES = 4;
const REASON_SENTENCES = 3;

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

/** The fields worth lifting out of a reply that will not parse. */
const REPORT_FIELDS = [
  'documentType', 'patientIdentity', 'findings',
  'abnormalMarkers', 'implications', 'advice', 'riskLevel',
] as const;

/**
 * One mapping, used by both the parsed reply and the salvaged one.
 *
 * Shared deliberately: a salvaged report that rendered differently from a
 * clean one would be a second code path to keep in step, and the whole point
 * is that the reader cannot tell the difference because there is none.
 */
function toReport(
  raw: any,
  findings: string,
  markers: readonly string[],
  implications: string,
  advice: string,
): ReportAnalysis {
  return {
    documentType: str(raw?.documentType, 'Document'),
    patientIdentity: str(raw?.patientIdentity, '[UNKNOWN]'),
    findings,
    abnormalMarkers: markers,
    implications,
    advice,
    riskLevel: RISKS.includes(raw?.riskLevel) ? raw.riskLevel as ReportRisk : 'Unknown',
    stages: readStages(raw?.neuralPulse?.stages),
    totalSeconds: typeof raw?.neuralPulse?.generationTime === 'number'
      ? raw.neuralPulse.generationTime
      : null,
  };
}

export class RemoteReportAnalyzer implements ReportService {
  constructor(private readonly api: ApiClient) {}

  async analyze(file: UploadFile): Promise<RemoteOutcome<ReportAnalysis>> {
    const started = Date.now();
    try {
      // The route is upload.single('reportFile'), so the field name is not
      // negotiable - a mismatch surfaces as "No file uploaded" from multer.
      const raw = await this.api.upload<any>(
        '/api/reports/analyze', 'reportFile', file, REPORT_TIMEOUT_MS,
      );

      /*
       * The model decides which of these it fills in, and it does not always
       * fill in `findings`. Requiring that one field meant a response with a
       * perfectly good set of implications and advice was thrown away as a
       * failure - and thrown away silently, because this path reported no
       * reason at all. That is what a bare "could not be read" with nothing in
       * brackets means.
       */
      const findings = str(raw?.findings, '');
      const implications = str(raw?.implications, '');
      const advice = str(raw?.advice, '');
      const markers = strings(raw?.abnormalMarkers);

      if (!findings && !implications && !advice && markers.length === 0) {
        /*
         * Nothing usable came back. Name the keys the server did send: a 200
         * with the wrong shape is otherwise indistinguishable from a 200 with
         * an empty one, and neither is visible from the screen.
         */
        const keys = raw && typeof raw === 'object' ? Object.keys(raw) : [];
        return fail(
          'FAILED', started, REPORT_NOTICE,
          keys.length ? `server sent: ${keys.slice(0, 8).join(', ')}` : 'empty response',
        );
      }

      return {
        status: 'OK',
        data: toReport(raw, findings, markers, implications, advice),
        notice: null,
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      /*
       * The server could not parse the model's reply, but it returned the
       * reply. Recover it here rather than discarding an answer that was
       * already generated - see domain/salvageJson for why these arrive
       * truncated and what is and is not repaired.
       */
      const salvaged = error instanceof ApiError
        ? salvageJson((error.body as any)?.raw, REPORT_FIELDS)
        : null;

      if (salvaged) {
        const findings = str(salvaged.findings, '');
        const implications = str(salvaged.implications, '');
        const advice = str(salvaged.advice, '');
        const markers = strings(salvaged.abnormalMarkers);

        if (findings || implications || advice || markers.length > 0) {
          return {
            status: 'OK',
            data: toReport(salvaged, findings, markers, implications, advice),
            notice: null,
            elapsedMs: Date.now() - started,
          };
        }
      }

      const detail = serverDetail(error);

      /*
       * A queued request is not a failed document. Gemini's 503 says the model
       * is busy, and saying "the report could not be read" over that sends
       * someone off to find a different file for a problem that clears on its
       * own. The reason is still shown, because "busy" without evidence is the
       * kind of reassurance that hides a real fault.
       */
      if (isBusy(detail)) {
        return {
          status: 'FAILED',
          data: null,
          notice: `${BUSY_NOTICE} (${detail})`,
          elapsedMs: Date.now() - started,
        };
      }

      return fail(classify(error, this.api.configured), started, REPORT_NOTICE, detail);
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
