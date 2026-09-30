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
    }
  }

  async get<T>(endpoint: string, timeoutMs = this.timeoutMs): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

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
    }
  }

  async post<T>(endpoint: string, body: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);

    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

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
    }
  }
}
