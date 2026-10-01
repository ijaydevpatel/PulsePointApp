import { ApiClient, ApiError, DEFAULT_TIMEOUT_MS } from '../src/data/apiClient';
import { RemoteSymptomAnalysis } from '../src/data/remoteServices';

/*
 * Completes the fault-injection matrix. Latency and timeout are covered in
 * analysisTimeout.test.ts; this file covers the two remaining injected faults:
 * a 5xx server response, and a transport failure (dropped link).
 *
 * The contract that matters to the UI is that a failure is never rendered as an
 * empty success, and that a dropped link is not reported as a timeout.
 */

const REQUEST = { activeSymptoms: ['cough'], customSymptom: '' };

function clientWith(fetchImpl: any): ApiClient {
  const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, fetchImpl);
  api.setTokenProvider(async () => 'token');
  return api;
}

function respondWith(status: number, body: unknown, contentType = 'application/json') {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: async () => body,
  } as any));
}

/** A transport failure: fetch rejects before any response exists. */
function droppedLink(message = 'Network request failed') {
  return jest.fn(async () => { throw new TypeError(message); });
}

describe('injected fault: server error', () => {
  it('reports HTTP 500 as a failure, not an empty success', async () => {
    const service = new RemoteSymptomAnalysis(
      clientWith(respondWith(500, { message: 'Upstream model unavailable' })),
    );

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).toBe('FAILED');
    expect(outcome.data).toBeNull();
    expect(outcome.notice).toBeTruthy();
  });

  it('does not mistake a server error for a timeout', async () => {
    const service = new RemoteSymptomAnalysis(
      clientWith(respondWith(503, { message: 'Service unavailable' })),
    );

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).not.toBe('TIMEOUT');
  });

  it('separates an expired session from a server fault', async () => {
    const service = new RemoteSymptomAnalysis(
      clientWith(respondWith(401, { message: 'Token expired' })),
    );

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).toBe('UNAUTHENTICATED');
    expect(outcome.data).toBeNull();
  });

  it('treats an HTML error page as a failure rather than parsing it', async () => {
    const service = new RemoteSymptomAnalysis(
      clientWith(respondWith(502, '<html>Bad Gateway</html>', 'text/html')),
    );

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).toBe('FAILED');
    expect(outcome.data).toBeNull();
  });
});

describe('injected fault: dropped link', () => {
  it('reports a transport failure rather than hanging or returning data', async () => {
    const service = new RemoteSymptomAnalysis(clientWith(droppedLink()));

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).toBe('FAILED');
    expect(outcome.data).toBeNull();
    expect(outcome.notice).toBeTruthy();
  });

  it('does not report a dropped link as a timeout', async () => {
    // The Overpass investigation turned on exactly this distinction: a request
    // that is never answered is not the same event as one answered slowly.
    const service = new RemoteSymptomAnalysis(clientWith(droppedLink()));

    const outcome = await service.analyze(REQUEST);

    expect(outcome.status).not.toBe('TIMEOUT');
  });

  it('still records how long the attempt took', async () => {
    const service = new RemoteSymptomAnalysis(clientWith(droppedLink()));

    const outcome = await service.analyze(REQUEST);

    expect(typeof outcome.elapsedMs).toBe('number');
    expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

describe('ApiError carries the status it was built from', () => {
  it('keeps the HTTP status for the caller to branch on', () => {
    const error = new ApiError('Request failed', 500);

    expect(error.status).toBe(500);
    expect(error).toBeInstanceOf(Error);
  });
});
