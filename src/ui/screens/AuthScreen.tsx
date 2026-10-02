import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Keyboard, BackHandler,
  useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
// @ts-ignore - Clerk ships no types for the Expo hook surface.
import { useAuth, useUser, useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';

import { Icon } from '../components/Icon';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { Session } from '../../domain/auth';
import { ClerkAuthGateway } from '../../data/clerkAuth';
import { AuthBackground } from '../auth/AuthBackground';
import {
  AuthError, AuthField, AuthSwitcher, EmailMark, GoogleMark,
  Hero, PillButton, Rise, Wordmark,
} from '../auth/AuthPrimitives';
import { C, COLUMN, COPY, Gaps, T, gaps } from '../auth/authTheme';
import {
  confirmError, emailError, humanAuthError, nameError, passwordError,
} from '../auth/authErrors';

WebBrowser.maybeCompleteAuthSession();

type Mode =
  | 'login' | 'signup'
  | 'emailLogin' | 'emailSignup'
  | 'verify' | 'reset'
  | 'welcome';

function backTarget(m: Mode): Mode | null {
  switch (m) {
    case 'login': return 'welcome';
    case 'signup': return 'login';
    case 'emailLogin': return 'login';
    case 'emailSignup': return 'signup';
    case 'verify': return 'emailSignup';
    case 'reset': return 'emailLogin';
    default: return null;
  }
}

export function AuthScreen({ onEnterApp, onDone, initialMode = 'welcome' }: {
  onEnterApp: () => void;
  onDone: (s: Session) => void;
  initialMode?: Mode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);

  const clerkAuth = useAuth();
  const clerkUser = useUser();
  const clerkSignIn = useSignIn();
  const clerkSignUp = useSignUp();
  const { startSSOFlow } = useSSO();

  const gateway = new ClerkAuthGateway(clerkAuth, clerkUser, clerkSignIn, clerkSignUp);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [fieldErr, setFieldErr] = useState<Record<string, string | null>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [busy, setBusy] = useState<null | 'google' | 'submit' | 'resend'>(null);
  const [resendIn, setResendIn] = useState(0);

  const submitting = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  const go = useCallback((m: Mode) => {
    setMode(m);
    setFieldErr({});
    setFormErr(null);
    setNotice(null);
  }, []);

  const signedIn = clerkAuth?.isSignedIn === true;
  useEffect(() => {
    if (signedIn) onEnterApp();
  }, [signedIn, onEnterApp]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const up = backTarget(mode);
      if (up) { go(up); return true; }
      return false;
    });
    return () => sub.remove();
  }, [mode, go]);

  const onGoogle = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy('google'); setFormErr(null);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'pulsepoint', path: 'sso-callback' });
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });

      if (!createdSessionId) return;

      if (setActive) await setActive({ session: createdSessionId });
      onEnterApp();
    } catch (e) {
      setFormErr(humanAuthError(e));
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }, [startSSOFlow, onEnterApp]);

  const onEmailLogin = useCallback(async () => {
    const errs = { email: emailError(email), pw: passwordError(pw) };
    setFieldErr(errs);
    if (errs.email || errs.pw) return;

    if (submitting.current) return;
    submitting.current = true;
    setBusy('submit'); setFormErr(null);
    Keyboard.dismiss();
    try {
      onDone(await gateway.signIn(email.trim(), pw));
      onEnterApp();
    } catch (e) {
      if ((e as Error)?.message === 'VERIFICATION_REQUIRED') { go('verify'); return; }
      setFormErr(humanAuthError(e));
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }, [email, pw, gateway, onDone, go, onEnterApp]);

  const onEmailSignup = useCallback(async () => {
    const errs = {
      name: nameError(fullName),
      email: emailError(email),
      pw: passwordError(pw),
      confirm: confirmError(pw, confirmPw),
    };
    setFieldErr(errs);
    if (errs.name || errs.email || errs.pw || errs.confirm) return;

    if (submitting.current) return;
    submitting.current = true;
    setBusy('submit'); setFormErr(null);
    Keyboard.dismiss();
    try {
      onDone(await gateway.signUp(email.trim(), pw, fullName.trim()));
      onEnterApp();
    } catch (e) {
      if ((e as Error)?.message === 'VERIFICATION_REQUIRED') { go('verify'); return; }
      setFormErr(humanAuthError(e));
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }, [fullName, email, pw, confirmPw, gateway, onDone, go, onEnterApp]);

  const onVerify = useCallback(async () => {
    if (code.trim().length < 6) {
      setFieldErr({ code: 'Enter the six-digit code from your email.' });
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy('submit'); setFormErr(null);
    try {
      onDone(await gateway.verify(code.trim()));
      onEnterApp();
    } catch (e) {
      setFormErr(humanAuthError(e));
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }, [code, gateway, onDone, onEnterApp]);

  const onResend = useCallback(async () => {
    if (resendIn > 0 || busy) return;
    setBusy('resend'); setFormErr(null);
    try {
      await gateway.resendCode();
      setResendIn(30);
      setNotice('We sent another code.');
    } catch (e) {
      setFormErr(humanAuthError(e));
    } finally { setBusy(null); }
  }, [resendIn, busy, gateway]);

  const onReset = useCallback(async () => {
    const e1 = emailError(email);
    setFieldErr({ email: e1 });
    if (e1) return;

    if (submitting.current) return;
    submitting.current = true;
    setBusy('submit'); setFormErr(null);
    Keyboard.dismiss();
    try {
      await gateway.requestPasswordReset(email.trim());
    } catch {
    } finally {
      setNotice('If that email has an account, a reset link is on its way.');
      setBusy(null);
      submitting.current = false;
    }
  }, [email, gateway]);

  const back = backTarget(mode);
  const g = useMemo(() => gaps(height, width), [height, width]);

  const scrollPad = useMemo(() => {
    if (mode === 'welcome') {
      const pad = Math.max(insets.top, insets.bottom) + 12;
      return { paddingTop: pad, paddingBottom: pad };
    }
    return { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 };
  }, [mode, insets.top, insets.bottom]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <AuthBackground variant={mode === 'welcome' ? 'welcome' : 'auth'} width={width} height={height} />

      <KeyboardSafe>
        <ScrollView
          contentContainerStyle={[st.scroll, scrollPad]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {back ? (
            <Pressable
              onPress={() => go(back)}
              style={[st.back, { top: insets.top + 12 }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Icon name="chevronLeft" size={22} color={C.ink} />
            </Pressable>
          ) : null}

          {mode === 'welcome'
            ? <WelcomePane onStart={() => go('login')} g={g} />
            : (
              <ChooseOrForm
                mode={mode}
                g={g}
                go={go}
                busy={busy}
                formErr={formErr}
                notice={notice}
                fieldErr={fieldErr}
                setFieldErr={setFieldErr}
                fullName={fullName} setFullName={setFullName}
                email={email} setEmail={setEmail}
                pw={pw} setPw={setPw}
                confirmPw={confirmPw} setConfirmPw={setConfirmPw}
                code={code} setCode={setCode}
                showPw={showPw} setShowPw={setShowPw}
                resendIn={resendIn}
                onGoogle={onGoogle}
                onEmailLogin={onEmailLogin}
                onEmailSignup={onEmailSignup}
                onVerify={onVerify}
                onResend={onResend}
                onReset={onReset}
              />
            )}
        </ScrollView>
      </KeyboardSafe>
    </View>
  );
}

function WelcomePane({ onStart, g }: {
  onStart: () => void; g: Gaps;
}) {
  return (
    <View style={[st.welcomeBody, { paddingHorizontal: g.edge }]}>
      <Rise delay={0}><Wordmark large /></Rise>

      <Rise delay={90} style={{ marginTop: g.logoToHero }}>
        <Hero lines={COPY.welcomeHero} />
      </Rise>

      <Rise delay={180} style={[st.welcomeCta, { marginTop: g.heroToButtons }]}>
        <PillButton
          label="LET'S GET STARTED"
          uppercase
          widthRatio={0.82}

          icon={<Icon name="arrowRight" size={18} color={C.accentSoft} weight="bold" />}
          onPress={onStart}
          accessibilityHint="Continues to sign in"
        />
      </Rise>
    </View>
  );
}

function ChooseOrForm(p: {
  mode: Mode;
  g: Gaps;
  go: (m: Mode) => void;
  busy: null | 'google' | 'submit' | 'resend';
  formErr: string | null;
  notice: string | null;
  fieldErr: Record<string, string | null>;
  setFieldErr: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  pw: string; setPw: (v: string) => void;
  confirmPw: string; setConfirmPw: (v: string) => void;
  code: string; setCode: (v: string) => void;
  showPw: boolean; setShowPw: (v: boolean) => void;
  resendIn: number;
  onGoogle: () => void;
  onEmailLogin: () => void;
  onEmailSignup: () => void;
  onVerify: () => void;
  onResend: () => void;
  onReset: () => void;
}) {
  const { mode, g, go, busy, fieldErr, setFieldErr } = p;
  const isSignupSide = mode === 'signup' || mode === 'emailSignup';

  const hero =
    mode === 'login' ? COPY.loginHero
    : mode === 'signup' ? COPY.signupHero
    : mode === 'emailLogin' ? COPY.emailLoginHero
    : mode === 'emailSignup' ? COPY.emailSignupHero
    : mode === 'verify' ? ['Check your', 'inbox.']
    : ['Reset your', 'password.'];

  const blur = (key: string, check: () => string | null) =>
    () => setFieldErr((f) => ({ ...f, [key]: check() }));

  return (
    <View style={[st.body, { paddingHorizontal: g.edge, paddingTop: g.top }]}>
      <Rise delay={0}><Wordmark /></Rise>

      <Rise delay={80} style={{ marginTop: g.logoToHero }}>
        <Hero lines={hero} />
      </Rise>

      {mode === 'login' || mode === 'signup' ? (
        <>
          <Rise delay={160} style={[st.buttons, { marginTop: g.heroToButtons }]}>
            <PillButton
              label="Continue with Google"
              icon={<GoogleMark />}
              busy={busy === 'google'}
              disabled={busy !== null && busy !== 'google'}
              onPress={p.onGoogle}
            />
            <View style={{ height: g.betweenButtons }} />
            <PillButton
              label="Continue with Email"
              icon={<EmailMark />}
              disabled={busy !== null}
              onPress={() => go(isSignupSide ? 'emailSignup' : 'emailLogin')}
            />
            {p.formErr ? <AuthError text={p.formErr} /> : null}
          </Rise>

          <Rise delay={240} style={{ marginTop: g.buttonsToSwitcher }}>
            <AuthSwitcher
              prompt={isSignupSide ? 'Already have an account?' : "Don't have an account yet?"}
              action={isSignupSide ? 'Sign in here' : 'Register one here'}
              onPress={() => go(isSignupSide ? 'login' : 'signup')}
            />
          </Rise>
        </>
      ) : null}

      {mode === 'emailLogin' ? (
        <>
          <Rise delay={160} style={[st.form, { marginTop: g.heroToForm }]}>
            <AuthField
              label="Email address"
              value={p.email}
              onChangeText={p.setEmail}
              onBlur={blur('email', () => emailError(p.email))}
              error={fieldErr.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="next"
            />
            <AuthField
              label="Password"
              value={p.pw}
              onChangeText={p.setPw}
              onBlur={blur('pw', () => passwordError(p.pw))}
              error={fieldErr.pw}
              secure
              secureVisible={p.showPw}
              onToggleSecure={() => p.setShowPw(!p.showPw)}
              autoComplete="current-password"
              textContentType="password"
              placeholder="Your password"
              returnKeyType="go"
              onSubmitEditing={p.onEmailLogin}
            />

            <Pressable
              onPress={() => go('reset')}
              style={st.forgotRight}
              accessibilityRole="link"
              accessibilityLabel="Forgot password?"
              hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
            >
              <Text style={T.link}>Forgot password?</Text>
            </Pressable>

            {p.formErr ? <AuthError text={p.formErr} /> : null}
            {p.notice ? <Notice text={p.notice} /> : null}

            <View style={st.submitRow}>
              <PillButton
                label="Continue"
                busy={busy === 'submit'}
                disabled={busy !== null && busy !== 'submit'}
                onPress={p.onEmailLogin}
                widthRatio={1}
              />
            </View>
          </Rise>

          <Rise delay={240} style={{ marginTop: g.buttonsToSwitcher }}>
            <AuthSwitcher
              prompt="Don't have an account yet?"
              action="Register one here"
              onPress={() => go('signup')}
            />
          </Rise>
        </>
      ) : null}

      {mode === 'emailSignup' ? (
        <>
          <Rise delay={160} style={[st.form, { marginTop: g.heroToForm }]}>
            <AuthField
              label="Full name"
              value={p.fullName}
              onChangeText={p.setFullName}
              onBlur={blur('name', () => nameError(p.fullName))}
              error={fieldErr.name}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Your name"
            />
            <AuthField
              label="Email address"
              value={p.email}
              onChangeText={p.setEmail}
              onBlur={blur('email', () => emailError(p.email))}
              error={fieldErr.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            <AuthField
              label="Password"
              value={p.pw}
              onChangeText={p.setPw}
              onBlur={blur('pw', () => passwordError(p.pw))}
              error={fieldErr.pw}
              secure
              secureVisible={p.showPw}
              onToggleSecure={() => p.setShowPw(!p.showPw)}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 8 characters"
            />
            <AuthField
              label="Confirm password"
              value={p.confirmPw}
              onChangeText={p.setConfirmPw}
              onBlur={blur('confirm', () => confirmError(p.pw, p.confirmPw))}
              error={fieldErr.confirm}
              secure
              secureVisible={p.showPw}
              onToggleSecure={() => p.setShowPw(!p.showPw)}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="Repeat your password"
              returnKeyType="go"
              onSubmitEditing={p.onEmailSignup}
            />

            {p.formErr ? <AuthError text={p.formErr} /> : null}

            <View style={st.submitRow}>
              <PillButton
                label="Create account"
                busy={busy === 'submit'}
                disabled={busy !== null && busy !== 'submit'}
                onPress={p.onEmailSignup}
                widthRatio={1}
              />
            </View>
          </Rise>

          <Rise delay={240} style={{ marginTop: g.buttonsToSwitcher }}>
            <AuthSwitcher
              prompt="Already have an account?"
              action="Sign in here"
              onPress={() => go('login')}
            />
          </Rise>
        </>
      ) : null}

      {mode === 'verify' ? (
        <Rise delay={160} style={[st.form, { marginTop: g.heroToForm }]}>
          <Text style={[T.prompt, st.centreCopy]}>
            Enter the six-digit code we sent to {p.email || 'your email'}.
          </Text>

          <AuthField
            label="Verification code"
            value={p.code}
            onChangeText={(v) => {
              p.setCode(v);
              if (v.length === 6) Keyboard.dismiss();
            }}
            error={fieldErr.code}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            placeholder="000000"
          />

          {p.formErr ? <AuthError text={p.formErr} /> : null}
          {p.notice ? <Notice text={p.notice} /> : null}

          <View style={st.submitRow}>
            <PillButton
              label="Verify"
              busy={busy === 'submit'}
              disabled={busy !== null && busy !== 'submit'}
              onPress={p.onVerify}
              widthRatio={1}
            />
          </View>

          <Pressable
            onPress={p.onResend}
            disabled={p.resendIn > 0 || busy !== null}
            style={st.forgot}
            accessibilityRole="button"
            accessibilityState={{ disabled: p.resendIn > 0 }}
            hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
          >
            <Text style={p.resendIn > 0 ? [T.prompt, { fontSize: 14, color: C.ink3 }] : T.link}>
              {p.resendIn > 0 ? `Resend code in ${p.resendIn}s` : 'Resend code'}
            </Text>
          </Pressable>
        </Rise>
      ) : null}

      {mode === 'reset' ? (
        <Rise delay={160} style={[st.form, { marginTop: g.heroToForm }]}>
          <Text style={[T.prompt, st.centreCopy]}>
            Enter your email and we'll send you a link to set a new password.
          </Text>

          <AuthField
            label="Email address"
            value={p.email}
            onChangeText={p.setEmail}
            onBlur={blur('email', () => emailError(p.email))}
            error={fieldErr.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
            returnKeyType="go"
            onSubmitEditing={p.onReset}
          />

          {p.formErr ? <AuthError text={p.formErr} /> : null}
          {p.notice ? <Notice text={p.notice} /> : null}

          <View style={st.submitRow}>
            <PillButton
              label="Send reset link"
              busy={busy === 'submit'}
              disabled={busy !== null && busy !== 'submit'}
              onPress={p.onReset}
              widthRatio={1}
            />
          </View>
        </Rise>
      ) : null}
    </View>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View style={st.noticeRow} accessibilityLiveRegion="polite">
      <Icon name="check" size={14} color={C.ink2} />
      <Text style={[T.prompt, { fontSize: 13.5, flex: 1, lineHeight: 19 }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  back: {
    position: 'absolute', left: 12, zIndex: 10,
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },

  body: { flex: 1, alignItems: 'center' },
  buttons: { width: '100%', alignItems: 'center' },
  form: { width: `${COLUMN * 100}%`, alignItems: 'center' },
  submitRow: { alignItems: 'center', marginTop: 10, width: '100%' },
  forgotRight: { alignSelf: 'flex-end', paddingVertical: 2, marginTop: -6 },

  centreCopy: { textAlign: 'center', fontSize: 15, lineHeight: 22, marginBottom: 26, paddingHorizontal: 8 },
  forgot: { marginTop: 20, alignSelf: 'center', paddingVertical: 4 },

  noticeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 16, paddingHorizontal: 4,
  },

  welcomeBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcomeCta: { width: '100%', alignItems: 'center' },
});
