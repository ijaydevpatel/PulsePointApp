/**
 * Clerk-backed identity.
 *
 * Two things live here: the token cache, and a gateway that adapts Clerk's
 * hook objects to the AuthGateway interface the domain owns (L1).
 *
 * The gateway is constructed inside the component with the *current* hook
 * values, because Clerk's objects are recreated on each render and a captured
 * one goes stale. It is cheap to build and holds no state of its own.
 */
import * as SecureStore from 'expo-secure-store';
import { AuthGateway, Session, GUEST } from '../domain/auth';

/* ───────────────────────────── token cache ─────────────────────────────── */

/**
 * Session JWTs are credentials, so they go in SecureStore (Android Keystore /
 * iOS Keychain) rather than AsyncStorage, which is plain text on disk. That is
 * requirement P2, and the same reasoning behind SQLCipher for the episode store.
 *
 * Every method swallows its error and degrades to "no cached token": a keystore
 * failure should make the user sign in again, never crash the app on launch.
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* a failed write means the next launch asks for sign-in again */
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* nothing to do — the session is being discarded anyway */
    }
  },
};

/* ─────────────────────────────── gateway ───────────────────────────────── */

/**
 * Shapes of the Clerk hook returns, kept loose on purpose. Typing these against
 * Clerk's exported interfaces couples this file to their minor versions for no
 * benefit — only these members are ever touched.
 */
type ClerkAuthHook = {
  isSignedIn?: boolean;
  userId?: string | null;
  // `any` rather than `unknown` for the options bag: parameters are
  // contravariant, so `unknown` would reject Clerk's own narrower GetToken type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getToken: (opts?: any) => Promise<string | null>;
  signOut: () => Promise<unknown>;
};
type ClerkUserHook = { user?: { id: string; fullName?: string | null; username?: string | null; primaryEmailAddress?: { emailAddress?: string } | null } | null };
type ClerkSignInHook = { isLoaded: boolean; signIn?: any; setActive?: any };
type ClerkSignUpHook = { isLoaded: boolean; signUp?: any; setActive?: any };

export class ClerkAuthGateway implements AuthGateway {
  constructor(
    private readonly auth: ClerkAuthHook,
    private readonly userHook: ClerkUserHook,
    private readonly signInHook: ClerkSignInHook,
    private readonly signUpHook: ClerkSignUpHook,
  ) {}

  async current(): Promise<Session> {
    return this.toSession();
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { isLoaded, signIn, setActive } = this.signInHook;
    if (!isLoaded || !signIn) throw new Error('Sign-in is not ready yet.');

    const attempt = await signIn.create({ identifier: email, password });

    // Anything other than 'complete' means Clerk wants another factor — a
    // verification code, say. Surfacing that plainly beats leaving the user on
    // a spinner that never resolves.
    if (attempt.status !== 'complete') {
      throw new Error('Additional verification is required to finish signing in.');
    }

    if (setActive) await setActive({ session: attempt.createdSessionId });
    return this.toSession(attempt.createdSessionId);
  }

  async signUp(email: string, password: string): Promise<Session> {
    const { isLoaded, signUp, setActive } = this.signUpHook;
    if (!isLoaded || !signUp) throw new Error('Sign-up is not ready yet.');

    const attempt = await signUp.create({ emailAddress: email, password });

    // Clerk instances commonly require email verification before the session
    // becomes active. That is a legitimate state, not a failure, so it gets its
    // own message rather than a generic error.
    if (attempt.status !== 'complete') {
      throw new Error('Check your email to verify the account, then sign in.');
    }

    if (setActive) await setActive({ session: attempt.createdSessionId });
    return this.toSession(attempt.createdSessionId);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  /**
   * Bearer token for the backend. Every /api route runs `protect`, which calls
   * Clerk's verifyToken with CLERK_SECRET_KEY — so this is the same session JWT
   * the website sends, and one account works across both.
   *
   * A refresh failure is a signed-out state, not a crash: the services map null
   * onto UNAUTHENTICATED and the UI already words that.
   */
  async getToken(): Promise<string | null> {
    try {
      return await this.auth.getToken();
    } catch {
      return null;
    }
  }

  private toSession(fallbackId?: string | null): Session {
    const user = this.userHook.user;
    const id = this.auth.userId ?? user?.id ?? fallbackId ?? null;
    if (!id) return GUEST;

    const displayName =
      user?.fullName
      || user?.username
      || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
      || 'You';

    return {
      state: 'SIGNED_IN',
      userId: id,
      displayName,
      cachedAt: new Date().toISOString(),
    };
  }
}
