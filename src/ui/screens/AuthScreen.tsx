/**
 * PulsePoint authentication and onboarding.
 *
 * Seven states, one composition. The flow opens on welcome, which leads to
 * login; from there Google or email, or across to sign up. A completed
 * sign-in leaves this screen for the application.
 *
 *   welcome → login → { google | email } ─┐
 *                 └──→ signup → { … } ─────┴→ PulsePoint
 *
 * Every state draws the same background, the same wordmark, the same hero
 * treatment and the same pill buttons — Login and Sign Up are not two screens
 * that resemble each other, they are one screen with different content.
 *
 * ── What is deliberately absent ──────────────────────────────────────────────
 *
 * There is no Apple button, no Facebook, no phone number, no magic link. The
 * two ways in are Google and email/password, and nothing on these screens
 * suggests otherwise.
 *
 * There is also no imagery. An earlier revision put the beating-heart video on
 * the welcome screen; a medical illustration is the one thing guaranteed to
 * make a health app read as a clinic, and the empty space does more work.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 * The provider stays behind ClerkAuthGateway, which implements the domain's
 * AuthGateway port. Nothing in this file knows what Clerk is beyond the hooks
 * it has to call to build the gateway, and the screens themselves only ever
 * call signIn / signUp / verify / resendCode / current. Swapping the provider
 * would not touch this file's layout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Keyboard, BackHandler,
  useWindowDimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
// @ts-ignore — Clerk ships no types for the Expo hook surface.
import { useAuth, useUser, useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';

import { Icon } from '../components/Icon';
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

/**
 * Dismisses the browser tab Clerk redirects back through. Must run at module
 * scope: by the time a component mounts, the redirect has already resolved.
 */
WebBrowser.maybeCompleteAuthSession();

type Mode =
  | 'login' | 'signup'
  | 'emailLogin' | 'emailSignup'
  | 'verify' | 'reset'
  | 'welcome';

/**
 * Where "back" goes from each state.
 *
 * One step up the flow rather than straight out, so someone who mistyped a
 * password lands on the provider choice instead of being dropped out of the
 * app. Both the hardware gesture and the on-screen chevron read this, which is
 * why it is one pure function rather than two switch statements.
 *
 * `welcome` returns null — it is the root, and the first thing anyone sees.
 */
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
  /** Authentication finished — hand control to the main application. */
  onEnterApp: () => void;
  onDone: (s: Session) => void;
  initialMode?: Mode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);

  /* ── provider ─────────────────────────────────────────────────────────── */

  const clerkAuth = useAuth();
  const clerkUser = useUser();
  const clerkSignIn = useSignIn();
  const clerkSignUp = useSignUp();
  const { startSSOFlow } = useSSO();

  /*
   * Rebuilt each render rather than memoised. Clerk recreates its hook objects
   * on every render, so a gateway captured in a ref would hold stale handles
   * and silently authenticate against a dead signIn resource. It is a thin
   * adapter over four objects — constructing it is free.
   */
  const gateway = new ClerkAuthGateway(clerkAuth, clerkUser, clerkSignIn, clerkSignUp);

  /* ── form state ───────────────────────────────────────────────────────── */

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);

  /**
   * Field errors appear on submit and on blur, never on keystroke — telling
   * someone their email is invalid while they are still halfway through
   * typing it is noise, and it trains people to ignore the message.
   */
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

  /* Pre-warms the custom tab so the Google sheet does not flash white. */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);

  /** Clears everything transient when the screen changes purpose. */
  const go = useCallback((m: Mode) => {
    setMode(m);
    setFieldErr({});
    setFormErr(null);
    setNotice(null);
  }, []);

  /*
   * Once a session exists, this flow is finished.
   *
   * Welcome is the *first* screen, not a reward at the end, so a signed-in
   * person has no business anywhere in here. This catches the paths that do
   * not run through a submit handler — Clerk restoring a session mid-render,
   * or setActive landing after the SSO sheet closes — and hands straight over
   * to the application.
   */
  const signedIn = clerkAuth?.isSignedIn === true;
  useEffect(() => {
    if (signedIn) onEnterApp();
  }, [signedIn, onEnterApp]);

  /*
   * Hardware back walks one step up the flow. Welcome is the root, so back
   * there falls through to the system default and leaves the app.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const up = backTarget(mode);
      if (up) { go(up); return true; }
      return false;
    });
    return () => sub.remove();
  }, [mode, go]);

  /* ── Google ───────────────────────────────────────────────────────────── */

  const onGoogle = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy('google'); setFormErr(null);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'pulsepoint', path: 'sso-callback' });
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });

      // No session id is the ordinary "closed the sheet" path. Reporting it as
      // a failure would blame the person for changing their mind.
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

  /* ── email submit ─────────────────────────────────────────────────────── */

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
      onDone(await gateway.signUp(email.trim(), pw));
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

  /**
   * Password reset.
   *
   * Always reports success, whether or not the address is registered. Saying
   * "no account with that email" turns the reset form into a way to test
   * whether a given person uses a health app, which is not information this
   * app should hand to whoever is holding the phone.
   */
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
      /* swallowed on purpose — see the note above */
    } finally {
      setNotice('If that email has an account, a reset link is on its way.');
      setBusy(null);
      submitting.current = false;
    }
  }, [email, gateway]);

  /* ── shell ────────────────────────────────────────────────────────────── */

  const back = backTarget(mode);
  const g = useMemo(() => gaps(height, width), [height, width]);
  /*
   * Welcome centres its content optically, so its padding has to be
   * symmetrical — an asymmetric pad silently shifts the centre by half the
   * difference, which is what made the group sit low with a void above it.
   * Both insets are honoured by taking the larger of the two on each side.
   *
   * The other states read top-down and keep the tighter, natural padding.
   */
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[st.scroll, scrollPad]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/*
            The back control is absolutely positioned rather than laid out in
            the column. In flow it added 44dp above the content, which shifted
            every "centred" block half that distance down the screen — and on
            welcome, where there is no back target at all, it was reserving
            space for a control that does not exist.
          */}
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
      </KeyboardAvoidingView>
    </View>
  );
}

/* ══════════════════════════════  WELCOME  ═══════════════════════════════ */

/**
 * Onboarding's last step. One heading, one button, nothing else — a second
 * option here would turn a full stop into a decision.
 */
function WelcomePane({ onStart, g }: {
  onStart: () => void; g: Gaps;
}) {
  /*
   * Centred, and centred by flex rather than by a measured offset.
   *
   * An earlier version pinned the block with paddingTop at 27% of the screen
   * height, reasoning about where the ellipse's upper curve falls. That put
   * the content low with a large dead area above it, and it could only ever
   * be right on the one device the fraction was picked for. The ellipse is
   * itself centred at 50% of the height, so centring the content in the
   * viewport lands it on the ellipse's centre on every screen, with the
   * curves reading as equal margins above and below.
   */
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
          // #D88B63 exactly. Decorative — the label carries the meaning —
          // so it owes nothing to the text-contrast gate.
          icon={<Icon name="arrowRight" size={18} color={C.accentSoft} weight="bold" />}
          onPress={onStart}
          accessibilityHint="Continues to sign in"
        />
      </Rise>
    </View>
  );
}

/* ═══════════════════════  CHOOSE / FORM / VERIFY  ═══════════════════════ */

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

  /** Validates one field on blur, leaving the others alone. */
  const blur = (key: string, check: () => string | null) =>
    () => setFieldErr((f) => ({ ...f, [key]: check() }));

  return (
    <View style={[st.body, { paddingHorizontal: g.edge, paddingTop: g.top }]}>
      <Rise delay={0}><Wordmark /></Rise>

      <Rise delay={80} style={{ marginTop: g.logoToHero }}>
        <Hero lines={hero} />
      </Rise>

      {/* ── provider choice ──────────────────────────────────────────── */}
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

      {/* ── email sign in ────────────────────────────────────────────── */}
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

      {/* ── email sign up ────────────────────────────────────────────── */}
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

      {/* ── verification code ────────────────────────────────────────── */}
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

      {/* ── password reset ───────────────────────────────────────────── */}
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

/** Neutral confirmation. Same shape as the error row, different colour. */
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
