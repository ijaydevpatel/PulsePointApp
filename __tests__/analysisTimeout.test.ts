/**
 * The diagnostic matrix is allowed longer than a normal request.
 *
 * The report-analyzer half of this file went with the Reports tab. What is
 * left is the symptom matrix, which shares the same deadline machinery and is
 * the reason that machinery exists.
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
import { RemoteSymptomAnalysis } from '../src/data/remoteServices';

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
