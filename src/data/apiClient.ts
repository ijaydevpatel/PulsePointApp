/**
 * Transport for the PulsePoint backend. Mirrors frontend/src/lib/api.ts so the
 * app and the website speak to the same server the same way.
 *
 * ── Key handling (P3) ────────────────────────────────────────────────────────
 *
 * No provider key lives here. GROQ_API_KEY and GEMINI_API_KEY stay in the
 * server environment; the app carries only EXPO_PUBLIC_API_URL, which is a
 * public address, and a Clerk session token belonging to the signed-in user.
 *
 * ── The HTML-instead-of-JSON guard ───────────────────────────────────────────
 *
 * Copied deliberately from the web client. A 404 page, a CORS failure or a 502
 * returns HTML, and calling .json() on it throws "Unexpected token '<'" deep in
 * the parser where no caller can interpret it. Checking content-type first
 * turns that into a state the UI can render.
 */
import { ENV } from '../config/env';

export type TokenProvider = () => Promise<string | null>;

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly isHtml = false) {
    super(message);
    this.name = 'ApiError';
  }
}

export const DEFAULT_TIMEOUT_MS = 30000; // model calls are slow; the UI shows progress

export class ApiClient {
  private tokenProvider: TokenProvider | null = null;

  constructor(
    private readonly baseUrl: string | null = ENV.apiUrl,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Injected from the Clerk session at startup. */
  setTokenProvider(p: TokenProvider): void { this.tokenProvider = p; }

  get configured(): boolean { return this.baseUrl !== null; }

  /**
   * Multipart upload. Used only by the analyzer, whose backend route runs
   * `multer` and reads a single field named `reportFile`.
   *
   * Content-Type is deliberately NOT set: React Native's fetch computes the
   * multipart boundary itself, and setting the header by hand produces a body
   * the server cannot split. The web client does the same thing for the same
   * reason (it deletes the header when the body is FormData).
   */
  async upload<T>(endpoint: string, field: string, file: { uri: string; name: string; mimeType: string }): Promise<T> {
    if (!this.baseUrl) throw new ApiError('No API URL configured', 0);
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) throw new ApiError('No session token', 401);

    const form = new FormData();
    form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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
          response.status,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param timeoutMs Override for calls that legitimately take longer than the
   *   default. A forced model generation behind a cold dyno can run past 30s,
   *   and nothing on screen is blocked waiting for it.
   */
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
          response.status,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param timeoutMs Override for generations that legitimately take longer
   *   than the default.
   *
   *   Thirty seconds is right for a request that reads a database. It is not
   *   right for one that waits on a 120B model to produce five ranked
   *   conditions, three treatment lists and a written synopsis - that runs
   *   past thirty seconds routinely, and the caller was being handed a
   *   timeout for a request the server was still working on and would have
   *   completed. The daily briefing hit the same wall and was given the same
   *   treatment.
   */
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
          response.status,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
