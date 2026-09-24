/**
 * The diagnostic matrix is allowed longer than a normal request.
 *
 * This is why the possible-conditions, synopsis and treatment sections never
 * appeared on the result screen. Every POST shared one thirty-second deadline,
 * which is generous for a request that reads a database and far too short for
 * one that waits on a 120B model to produce five ranked conditions, three
 * treatment lists and a written synopsis. The client aborted, mapped the abort
 * to TIMEOUT, and rendered "did not respond in time" - while the server went
 * on and finished an answer nothing was left to receive.
 *
 * Nothing about the rendering was wrong, which is why reading the screen code
 * found nothing. The response never arrived.
 *
 * These tests pin the deadline itself, because it is invisible on screen: a
 * regression here looks exactly like the model being slow.
 */
import { ApiClient, ApiError, DEFAULT_TIMEOUT_MS } from '../src/data/apiClient';
import { RemoteSymptomAnalysis, RemoteReportAnalyzer } from '../src/data/remoteServices';
import { REMOTE_NOTICE, REPORT_NOTICE } from '../src/domain/remote';

const OK_BODY = {
  probabilityMatrix: [{ name: 'Common cold', confidence: 70, severity: 'Medium' }],
  treatmentPathways: {
    allopathy: ['Paracetamol 500mg'],
    homeopathic: ['Aconite 30C'],
    homeRemedies: ['Steam inhalation'],
  },
  summaryText: 'A short synopsis.',
  isEmergencyOverride: false,
};

/** A fetch that answers after `delayMs` of fake time, honouring abort. */
function slowFetch(delayMs: number, body: unknown = OK_BODY) {
  return jest.fn((_url: string, init: any) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => body,
      } as any), delayMs);

      init?.signal?.addEventListener?.('abort', () => {
        clearTimeout(timer);
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
}

function clientWith(fetchImpl: any): ApiClient {
  const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, fetchImpl);
  api.setTokenProvider(async () => 'token');
  return api;
}

describe('analysis deadline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('survives a generation that takes longer than the default timeout', async () => {
    // 45 seconds: past the 30s default, comfortably inside the override. This
    // is the case that was failing.
    const api = clientWith(slowFetch(45_000));
    const promise = new RemoteSymptomAnalysis(api).analyze({
      activeSymptoms: ['Congestion'], customSymptom: '',
    });

    await jest.advanceTimersByTimeAsync(46_000);
    const outcome = await promise;

    expect(outcome.status).toBe('OK');
    expect(outcome.data?.probabilityMatrix).toHaveLength(1);
    expect(outcome.data?.treatmentPathways.allopathy).toEqual(['Paracetamol 500mg']);
  });

  it('still gives up eventually rather than hanging', async () => {
    const api = clientWith(slowFetch(10 * 60_000));
    const promise = new RemoteSymptomAnalysis(api).analyze({
      activeSymptoms: ['Congestion'], customSymptom: '',
    });

    await jest.advanceTimersByTimeAsync(2 * 60_000);
    const outcome = await promise;

    // A deadline that never fires is its own bug: the screen would sit on
    // "checking" for ever, which is the stalled panel this app exists to
    // avoid.
    expect(outcome.status).toBe('TIMEOUT');
    expect(outcome.notice).toBeTruthy();
  });

  it('leaves ordinary posts on the short default', async () => {
    const api = clientWith(slowFetch(45_000));

    const promise = api.post('/api/something/ordinary', {}).catch((e) => e);
    await jest.advanceTimersByTimeAsync(46_000);
    const result = await promise;

    /*
     * The override is per call, not a blanket relaxation. A route that is
     * merely slow should still surface as a failure quickly; only the model
     * generations get the long rope.
     */
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).name).toBe('AbortError');
  });

  it('reports a genuine failure as a failure, not a timeout', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Diagnostic engine fault' }),
    }) as any);

    const outcome = await new RemoteSymptomAnalysis(clientWith(fetchImpl)).analyze({
      activeSymptoms: ['Congestion'], customSymptom: '',
    });

    expect(outcome.status).toBe('FAILED');
    expect(outcome.data).toBeNull();
  });

  it('does not render an empty success', async () => {
    // The backend's own parse-failure fallback can return a shaped object with
    // nothing in it. That must not reach the screen as a result.
    const empty = { probabilityMatrix: [], treatmentPathways: {}, summaryText: '' };
    const promise = new RemoteSymptomAnalysis(
      clientWith(slowFetch(0, empty)),
    ).analyze({ activeSymptoms: ['Congestion'], customSymptom: '' });

    // Fake timers are on, so even a zero-delay response needs the clock moved.
    await jest.advanceTimersByTimeAsync(1);
    const outcome = await promise;

    expect(outcome.status).not.toBe('OK');
    expect(outcome.data).toBeNull();
  });
});

describe('ApiError', () => {
  it('is what a non-OK response produces', () => {
    expect(new ApiError('x', 500)).toBeInstanceOf(Error);
  });
});

describe('report upload deadline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const FILE = { uri: 'file:///r.pdf', name: 'r.pdf', mimeType: 'application/pdf' };
  const REPORT_BODY = {
    documentType: 'Blood test', findings: 'Everything within range.',
    abnormalMarkers: [], implications: 'No action needed.', advice: 'None.',
    riskLevel: 'Low', stages: [], totalSeconds: 71,
  };

  it('survives the two vision passes taking longer than a minute', async () => {
    /*
     * 70 seconds: past the 30s default and past the 90s the symptom matrix
     * gets is not needed, but a report is extraction plus synthesis over a
     * parsed document, which is the heaviest call in the app.
     */
    const api = clientWith(slowFetch(70_000, REPORT_BODY));
    const promise = new RemoteReportAnalyzer(api).analyze(FILE);

    await jest.advanceTimersByTimeAsync(71_000);
    const outcome = await promise;

    expect(outcome.status).toBe('OK');
    expect(outcome.data?.documentType).toBe('Blood test');
  });

  it('still gives up rather than hanging for ever', async () => {
    const api = clientWith(slowFetch(20 * 60_000));
    const promise = new RemoteReportAnalyzer(api).analyze(FILE);

    await jest.advanceTimersByTimeAsync(3 * 60_000);
    expect((await promise).status).toBe('TIMEOUT');
  });

  it('never promises an on-device result it does not have', async () => {
    /*
     * The failure appeared directly under the upload button reading "Your
     * on-device result above is complete". There is no on-device result on
     * this screen: the document is read by the hosted models or not at all.
     */
    const api = clientWith(slowFetch(20 * 60_000));
    const promise = new RemoteReportAnalyzer(api).analyze(FILE);
    await jest.advanceTimersByTimeAsync(3 * 60_000);

    expect((await promise).notice).not.toMatch(/device|offline/i);

    for (const state of ['UNAUTHENTICATED', 'UNAVAILABLE', 'TIMEOUT', 'FAILED'] as const) {
      expect(REPORT_NOTICE[state]).not.toBe(REMOTE_NOTICE[state]);
      expect(REPORT_NOTICE[state]).not.toMatch(/device|offline/i);
    }
  });
});

describe('what a failed report says', () => {
  const FILE = { uri: 'file:///r.pdf', name: 'r.pdf', mimeType: 'application/pdf' };

  const uploadFailing = (res: any) => {
    const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, (async () => res) as any);
    api.setTokenProvider(async () => 'token');
    return new RemoteReportAnalyzer(api).analyze(FILE);
  };

  it('repeats the reason the server gave', async () => {
    /*
     * "The report could not be read" on its own describes a rejected upload, a
     * model fault and a cold-start error page identically - on screen and to
     * anyone trying to fix it. The server already says which; it was being
     * discarded.
     */
    const out = await uploadFailing({
      ok: false, status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Report Analysis Fault: AI Quota Exceeded.' }),
    });

    expect(out.status).toBe('FAILED');
    expect(out.notice).toContain('AI Quota Exceeded');
  });

  it('names an HTML error page as one', async () => {
    // A 502 from a cold start returns HTML. Reported as a parse error before.
    const out = await uploadFailing({
      ok: false, status: 502,
      headers: { get: () => 'text/html' },
      json: async () => ({}),
    });

    expect(out.notice).toContain('502');
    expect(out.notice).toMatch(/not JSON/i);
  });

  it('names a failure that never reached the server', async () => {
    const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, (async () => {
      throw new TypeError('Network request failed');
    }) as any);
    api.setTokenProvider(async () => 'token');

    const out = await new RemoteReportAnalyzer(api).analyze(FILE);
    expect(out.notice).toContain('Network request failed');
  });
});

describe('a report the model filled in partially', () => {
  const FILE = { uri: 'file:///r.pdf', name: 'r.pdf', mimeType: 'application/pdf' };

  const returning = (body: unknown) => {
    const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, (async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
    })) as any);
    api.setTokenProvider(async () => 'token');
    return new RemoteReportAnalyzer(api).analyze(FILE);
  };

  it('accepts a report with no findings but real advice', async () => {
    /*
     * The model chooses which fields it fills in. Requiring `findings`
     * specifically threw away a usable answer as a failure - and silently,
     * since that path reported no reason, which is why the screen showed a
     * bare message with nothing in brackets.
     */
    const out = await returning({
      documentType: 'Discharge summary',
      implications: 'Recovery is on track.',
      advice: '1. Rest.',
      riskLevel: 'Low',
    });

    expect(out.status).toBe('OK');
    expect(out.data?.advice).toContain('Rest');
    expect(out.data?.findings).toBe('');
  });

  it('accepts one with only abnormal markers', async () => {
    const out = await returning({ abnormalMarkers: ['Low haemoglobin'], riskLevel: 'Moderate' });

    expect(out.status).toBe('OK');
    expect(out.data?.abnormalMarkers).toEqual(['Low haemoglobin']);
  });

  it('names the keys when nothing usable came back', async () => {
    // A 200 with the wrong shape is otherwise indistinguishable from a 200
    // with an empty one, and neither is visible from the screen.
    const out = await returning({ neuralPulse: {}, timestamp: 'now', somethingElse: 1 });

    expect(out.status).toBe('FAILED');
    expect(out.notice).toContain('server sent');
    expect(out.notice).toContain('neuralPulse');
  });

  it('says so when the body is empty', async () => {
    const out = await returning({});
    expect(out.notice).toContain('empty response');
  });
});
