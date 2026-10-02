import * as SecureStore from 'expo-secure-store';
import { AuthGateway, Session, GUEST, resolveDisplayName } from '../domain/auth';

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
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
    }
  },
};

type ClerkAuthHook = {
  isSignedIn?: boolean;
  userId?: string | null;

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

    console.error('Unexpected sign-in status:', attempt.status);
    throw new Error(`Clerk requires ${attempt.status.replace(/_/g, ' ')}. Please check your dashboard settings.`);
  }

  async signUp(email: string, password: string, fullName?: string): Promise<Session> {
    const { isLoaded, signUp, setActive } = this.signUpHook;
    if (!isLoaded || !signUp) throw new Error('Sign-up is not ready yet.');

    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName?.trim()) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0];
      if (parts.length > 1) lastName = parts.slice(1).join(' ');
    }

    const attempt = await signUp.create({
      emailAddress: email,
      password,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });

    if (attempt.status === 'complete') {
      if (setActive) await setActive({ session: attempt.createdSessionId });
      return this.toSession(attempt.createdSessionId);
    }

    if (attempt.status === 'missing_requirements') {
      await attempt.prepareEmailAddressVerification({ strategy: 'email_code' });
    }

    throw new Error('VERIFICATION_REQUIRED');
  }

  async verify(code: string): Promise<Session> {
    const { signIn, setActive: setSignInActive } = this.signInHook;
    const { signUp, setActive: setSignUpActive } = this.signUpHook;

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

    if (signIn && signIn.status === 'needs_identifier') {
      throw new Error('Your session has expired. Please go back and enter your email again.');
    }

    if (signUp && (signUp.status === 'missing_requirements' || signUp.status === 'unverified')) {
      console.log('Resending email code for sign-up');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return;
    }

    throw new Error('No active verification session found. Please try logging in again.');
  }

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

  async getToken(): Promise<string | null> {
    try {
      return await this.auth.getToken();
    } catch {
      return null;
    }
  }

  private toSession(fallbackId?: string | null): Session {
    const user = this.userHook.user as any;
    const id = this.auth.userId ?? user?.id ?? fallbackId ?? null;
    if (!id) return GUEST;

    const displayName = user ? resolveDisplayName(user) : null;

    return {
      state: 'SIGNED_IN',
      userId: id,
      displayName,
      cachedAt: new Date().toISOString(),
    };
  }
}
