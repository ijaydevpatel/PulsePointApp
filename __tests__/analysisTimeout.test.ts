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

    expect(outcome.status).toBe('TIMEOUT');
    expect(outcome.notice).toBeTruthy();
  });

  it('leaves ordinary posts on the short default', async () => {
    const api = clientWith(slowFetch(45_000));

    const promise = api.post('/api/something/ordinary', {}).catch((e) => e);
    await jest.advanceTimersByTimeAsync(46_000);
    const result = await promise;

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
    const empty = { probabilityMatrix: [], treatmentPathways: {}, summaryText: '' };
    const promise = new RemoteSymptomAnalysis(
      clientWith(slowFetch(0, empty)),
    ).analyze({ activeSymptoms: ['Congestion'], customSymptom: '' });

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
