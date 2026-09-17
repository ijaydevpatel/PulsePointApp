/**
 * FR11 — accounts.
 *
 * Design rule, and it is the important one: the account gates SYNC, not ACCESS.
 * Triage, red flags and the medicine check work with no account and no network.
 * Signing in only buys history sync across devices and remote enrichment.
 *
 * A login wall would break QR2 (FR1–FR5 available with the network disabled)
 * and would put a signup form in front of someone who is worried about their
 * symptoms. The web app gates everything behind Clerk; this deliberately does not.
 */
export type SessionState = 'GUEST' | 'SIGNED_IN' | 'EXPIRED_OFFLINE';

export interface Session {
  readonly state: SessionState;
  readonly userId: string | null;
  readonly displayName: string | null;
  /** Cached so the app opens offline. Expiry does not revoke local access. */
  readonly cachedAt: string | null;
}

export const GUEST: Session = {
  state: 'GUEST', userId: null, displayName: null, cachedAt: null,
};

/** IAuthGateway — Production-ready identity provider interface. */
export interface AuthGateway {
  current(): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string): Promise<Session>;
  verify(code: string): Promise<Session>;
  resendCode(): Promise<void>;
  /**
   * Starts a password reset for an address.
   *
   * Returns void rather than a result on purpose. Whether the address is
   * registered is not information the caller should be able to act on — a
   * reset form that distinguishes the two cases becomes a way to test whether
   * a named person uses a health app. The UI reports the same neutral message
   * either way, so there is nothing for this to return.
   */
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Bearer token for the backend, or null when there is none.
   *
   * Every /api route on the backend runs `protect`, so without this the server
   * answers 401 and the app can only ever show its local results. The fake
   * gateway returns null on purpose: it authenticates against nothing, so
   * inventing a token here would turn a clear 401 into a confusing 500.
   */
  getToken(): Promise<string | null>;
}

/** Local-only features never consult this. Sync features must. */
export function canSync(s: Session): boolean {
  return s.state === 'SIGNED_IN';
}
