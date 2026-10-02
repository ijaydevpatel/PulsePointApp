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
 * The person's first and last name, or null when the provider has not reported
 * one yet.
 *
 * Only the real name counts. The provider reports the account, the username and
 * the email before it reports firstName and lastName, so any fallback to those
 * puts the wrong text on screen and swaps it a moment later: the email local
 * part showed "k787jaydev", the username showed "ijaydevpatel". Null lets each
 * screen show its own neutral wording once, with no flicker and no handle
 * standing in for a name.
 */
export function resolveDisplayName(from: {
  readonly fullName?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}): string | null {
  const joined = [from.firstName, from.lastName]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(' ')
    .trim();
  if (joined) return joined;

  return from.fullName?.trim() || null;
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
