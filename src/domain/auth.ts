export type SessionState = 'GUEST' | 'SIGNED_IN' | 'EXPIRED_OFFLINE';

export interface Session {
  readonly state: SessionState;
  readonly userId: string | null;
  readonly displayName: string | null;

  readonly cachedAt: string | null;
}

export const GUEST: Session = {
  state: 'GUEST', userId: null, displayName: null, cachedAt: null,
};

/**
 * The person's name, or null when there isn't one yet.
 *
 * Deliberately no email-address fallback. The provider can report the account
 * before it reports the name, so falling back to the local part of the email
 * put "k787jaydev" on screen and swapped it for the real name a moment later.
 * Null lets each screen show its own neutral wording once, instead.
 */
export function resolveDisplayName(from: {
  readonly fullName?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly username?: string | null;
}): string | null {
  const full = from.fullName?.trim();
  if (full) return full;

  const joined = [from.firstName, from.lastName]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(' ')
    .trim();
  if (joined) return joined;

  return from.username?.trim() || null;
}

export interface AuthGateway {
  current(): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string, fullName?: string): Promise<Session>;
  verify(code: string): Promise<Session>;
  resendCode(): Promise<void>;

  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;

  getToken(): Promise<string | null>;
}

export function canSync(s: Session): boolean {
  return s.state === 'SIGNED_IN';
}
