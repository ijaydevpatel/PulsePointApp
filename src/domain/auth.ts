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

/** IAuthGateway — Clerk in Phase 8; a fake drives the UI until then. */
export interface AuthGateway {
  current(): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
}

/** Local-only features never consult this. Sync features must. */
export function canSync(s: Session): boolean {
  return s.state === 'SIGNED_IN';
}
