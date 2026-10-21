import { ENV } from '../config/env';

export type TokenProvider = () => Promise<string | null>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isHtml = false,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * D03. Every network call prints one line so a round trip can be measured from
 * a device rather than remembered. Route and duration only, never the token,
 * the body or anything a user typed. scripts/collect-latency.bat reads these
 * back out of Logcat.
 */
function logLatency(method: string, endpoint: string, startedAt: number): void {
  // Quiet under Jest. The suites drive this client with fake timers, so the
  // numbers there are meaningless and they bury the verify output.
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined) return;
  console.log(`PP-LATENCY ${method} ${endpoint} ${Date.now() - startedAt}`);
}

export class ApiClient {
  private tokenProvider: TokenProvider | null = null;

  constructor(
    private readonly baseUrl: string | null = ENV.apiUrl,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  setTokenProvider(p: TokenProvider): void { this.tokenProvider = p; }

  get configured(): boolean { return this.baseUrl !== null; }

  async upload<T>(
    endpoint: string,
    field: string,
    file: { uri: string; name: string; mimeType: string },
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

    const form = new FormData();
    form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
      });
      const contentType = response.headers?.get?.('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new ApiError('Server returned a non-JSON response', response.status, true);
      }
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          (data && typeof data.message === 'string') ? data.message : 'Upload failed',
          response.status, false, data,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
      logLatency('POST', endpoint, startedAt);
    }
  }

  async get<T>(endpoint: string, timeoutMs = this.timeoutMs): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const contentType = response.headers?.get?.('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new ApiError('Server returned a non-JSON response', response.status, true);
      }
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          (data && typeof data.message === 'string') ? data.message : 'Request failed',
          response.status, false, data,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
      logLatency('GET', endpoint, startedAt);
    }
  }

  async post<T>(endpoint: string, body: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);

    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = response.headers?.get?.('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new ApiError('Server returned a non-JSON response', response.status, true);
      }

      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          (data && typeof data.message === 'string') ? data.message : 'Request failed',
          response.status, false, data,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
      logLatency('POST', endpoint, startedAt);
    }
  }
}
