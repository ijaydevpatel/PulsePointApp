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

export interface AuthGateway {
  current(): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string): Promise<Session>;
  verify(code: string): Promise<Session>;
  resendCode(): Promise<void>;

  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;

  getToken(): Promise<string | null>;
}

export function canSync(s: Session): boolean {
  return s.state === 'SIGNED_IN';
}
