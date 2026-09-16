import { AuthGateway, Session, GUEST } from '../domain/auth';

/** Phase 8 replaces this with Clerk behind the same interface. */
export class FakeAuthGateway implements AuthGateway {
  private session: Session = GUEST;
  async current(): Promise<Session> { return this.session; }
  async signIn(email: string, _password?: string): Promise<Session> {
    await new Promise((r) => setTimeout(r, 350));
    this.session = {
      state: 'SIGNED_IN', userId: 'local-dev',
      displayName: email.split('@')[0] ?? 'You', cachedAt: new Date().toISOString(),
    };
    return this.session;
  }
  async signUp(email: string, password: string): Promise<Session> {
    return this.signIn(email, password);
  }
  async signOut(): Promise<void> { this.session = GUEST; }

  /**
   * Always null. This gateway does not talk to Clerk, so it has no token to
   * give. Returning a placeholder string would make the backend reject the
   * request as malformed rather than unauthenticated, which is a worse error
   * to debug — the services map a missing token onto UNAUTHENTICATED, and the
   * UI already has wording for that state.
   */
  async getToken(): Promise<string | null> { return null; }
}
