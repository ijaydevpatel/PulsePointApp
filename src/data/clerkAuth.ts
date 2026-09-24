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
      /* nothing to do - the session is being discarded anyway */
    }
  },
};

/* ─────────────────────────────── gateway ───────────────────────────────── */

/**
 * Shapes of the Clerk hook returns, kept loose on purpose. Typing these against
 * Clerk's exported interfaces couples this file to their minor versions for no
 * benefit - only these members are ever touched.
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

    console.log('Attempting sign-in for:', email);
    const attempt = await signIn.create({ identifier: email, password });
    console.log('SignIn attempt result status:', attempt.status);

    if (attempt.status === 'complete') {
      if (setActive) await setActive({ session: attempt.createdSessionId });
      return this.toSession(attempt.createdSessionId);
    }

    if (attempt.status === 'needs_first_factor' || attempt.status === 'needs_second_factor') {
      console.log('Factors available:', JSON.stringify(attempt.status === 'needs_first_factor' ? attempt.supportedFirstFactors : attempt.supportedSecondFactors));

      const factors = attempt.status === 'needs_first_factor'
        ? attempt.supportedFirstFactors
        : attempt.supportedSecondFactors;

      const factor = factors.find((f: any) => f.strategy === 'email_code');

      if (factor) {
        console.log('Triggering email_code for:', factor.emailAddressId);
        if (attempt.status === 'needs_first_factor') {
          await attempt.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: factor.emailAddressId,
          });
        } else {
          await attempt.prepareSecondFactor({ strategy: 'email_code' });
        }
      }
      throw new Error('VERIFICATION_REQUIRED');
    }

    // If it's not complete and doesn't need a factor we know, it's an error state
    console.error('Unexpected sign-in status:', attempt.status);
    throw new Error(`Clerk requires ${attempt.status.replace(/_/g, ' ')}. Please check your dashboard settings.`);
  }

  async signUp(email: string, password: string): Promise<Session> {
    const { isLoaded, signUp, setActive } = this.signUpHook;
    if (!isLoaded || !signUp) throw new Error('Sign-up is not ready yet.');

    const attempt = await signUp.create({ emailAddress: email, password });

    if (attempt.status === 'complete') {
      if (setActive) await setActive({ session: attempt.createdSessionId });
      return this.toSession(attempt.createdSessionId);
    }

    // Prepare for email verification if needed
    if (attempt.status === 'missing_requirements') {
      await attempt.prepareEmailAddressVerification({ strategy: 'email_code' });
    }

    throw new Error('VERIFICATION_REQUIRED');
  }

  async verify(code: string): Promise<Session> {
    const { signIn, setActive: setSignInActive } = this.signInHook;
    const { signUp, setActive: setSignUpActive } = this.signUpHook;

    // Try sign-in verification first
    if (signIn && signIn.status !== 'complete') {
      let attempt;
      if (signIn.status === 'needs_first_factor') {
        attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      } else {
        attempt = await signIn.attemptSecondFactor({ strategy: 'email_code', code });
      }

      if (attempt.status === 'complete') {
        if (setSignInActive) await setSignInActive({ session: attempt.createdSessionId });
        return this.toSession(attempt.createdSessionId);
      }
      throw new Error('Verification failed. Please check the code.');
    }

    // Try sign-up verification
    if (signUp && signUp.status !== 'complete') {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete') {
        if (setSignUpActive) await setSignUpActive({ session: attempt.createdSessionId });
        return this.toSession(attempt.createdSessionId);
      }
      throw new Error('Verification failed. Please check the code.');
    }

    throw new Error('No verification in progress.');
  }

  async resendCode(): Promise<void> {
    const { signIn } = this.signInHook;
    const { signUp } = this.signUpHook;

    console.log('Resend requested. SignIn status:', signIn?.status, 'SignUp status:', signUp?.status);

    if (!signIn && !signUp) {
      console.error('No signIn or signUp objects found in hooks');
      throw new Error('Verification session lost. Please go back and try logging in again.');
    }

    // Try to resend for sign-in
    if (signIn && (signIn.status === 'needs_first_factor' || signIn.status === 'needs_second_factor')) {
      const factor = signIn.supportedFirstFactors?.find(
        (f: any) => f.strategy === 'email_code'
      );
      if (factor) {
        console.log('Resending email code for sign-in factor:', factor.emailAddressId);
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: factor.emailAddressId,
        });
        return;
      }
    }

    // Handle session timeout/needs_identifier during resend
    if (signIn && signIn.status === 'needs_identifier') {
      throw new Error('Your session has expired. Please go back and enter your email again.');
    }

    // Try to resend for sign-up
    if (signUp && (signUp.status === 'missing_requirements' || signUp.status === 'unverified')) {
      console.log('Resending email code for sign-up');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return;
    }

    throw new Error('No active verification session found. Please try logging in again.');
  }

  /**
   * Sends a reset code to an address, if one is registered to it.
   *
   * Clerk answers `form_identifier_not_found` for an unknown address. That
   * error is swallowed rather than surfaced: distinguishing "no such account"
   * from "sent" lets anyone holding the phone test whether a given person uses
   * a health app. Every other failure still throws, so a genuine outage is not
   * reported to the person as a success.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { isLoaded, signIn } = this.signInHook;
    if (!isLoaded || !signIn) throw new Error('Sign-in is not ready yet.');

    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
    } catch (e: any) {
      const code = e?.errors?.[0]?.code;
      if (code === 'form_identifier_not_found') return;
      throw e;
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  /**
   * Bearer token for the backend. Every /api route runs `protect`, which calls
   * Clerk's verifyToken with CLERK_SECRET_KEY - so this is the same session JWT
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
