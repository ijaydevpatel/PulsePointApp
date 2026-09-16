/**
 * SmartNest-style Auth & Welcome Experience tailored for PulsePoint.
 *
 * Redesigned with a pure black background to allow the anatomical heart video
 * to blend seamlessly into the canvas, removing the "black box" appearance.
 */
import React, { useState, useRef } from 'react';
import {
  View, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  PanResponder, Animated, LayoutChangeEvent, useWindowDimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';
// @ts-ignore
import { useAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-expo';

import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Txt, Springy, Enter } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { AuthGateway, Session } from '../../domain/auth';
import { useTheme, TYPE, S, R, TOUCH } from '../theme';
import { ClerkAuthGateway } from '../../data/clerkAuth';

/* ──────────────────────────  SLIDE TO START BUTTON  ────────────────────────── */
function SlideToStart({ onComplete }: { onComplete: () => void }) {
  const panX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const knobSize = 46;
  const padding = 7;
  const maxSlide = Math.max(1, trackWidth - knobSize - padding * 2);

  const maxSlideRef = useRef(maxSlide);
  maxSlideRef.current = maxSlide;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const limit = maxSlideRef.current;
        const newX = Math.max(0, Math.min(limit, gestureState.dx));
        panX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const limit = maxSlideRef.current;
        if (gestureState.dx > limit * 0.55 || gestureState.vx > 0.35) {
          Animated.timing(panX, {
            toValue: limit,
            duration: 120,
            useNativeDriver: true,
          }).start(() => {
            onComplete();
            panX.setValue(0);
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleTap = () => {
    const limit = maxSlideRef.current;
    Animated.timing(panX, {
      toValue: limit,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
      panX.setValue(0);
    });
  };

  const textOpacity = panX.interpolate({
    inputRange: [0, Math.max(10, maxSlide * 0.5)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const chevronsOpacity = panX.interpolate({
    inputRange: [0, Math.max(10, maxSlide * 0.35)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={st.startPillButton}
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleTap}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          st.startIconCircle,
          {
            transform: [{ translateX: panX }],
          },
        ]}
      >
        <Icon name="arrowRight" size={20} color="#2563EB" />
      </Animated.View>

      <Animated.View pointerEvents="none" style={{ flex: 1, alignItems: 'center', opacity: textOpacity }}>
        <Txt t="heading" c="#FFFFFF" style={{ fontSize: 18, fontWeight: '700' }}>
          Start
        </Txt>
      </Animated.View>

      <Animated.View pointerEvents="none" style={{ flexDirection: 'row', gap: 2, marginRight: S.md, opacity: chevronsOpacity }}>
        <Icon name="chevronRight" size={16} color="rgba(255,255,255,0.6)" />
        <Icon name="chevronRight" size={16} color="rgba(255,255,255,0.8)" />
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

/* ──────────────────────────  MAIN AUTH SCREEN  ────────────────────────── */
export function AuthScreen({ onBack, onDone, initialMode = 'welcome' }: {
  onBack: () => void;
  onDone: (s: Session) => void;
  initialMode?: 'welcome' | 'in' | 'up';
}) {
  const { c: P } = useTheme();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'welcome' | 'in' | 'up'>(initialMode);

  // Clerk hooks
  const clerkAuth = useAuth();
  const clerkUser = useUser();
  const clerkSignIn = useSignIn();
  const clerkSignUp = useSignUp();

  // Create gateway instance dynamically so it has access to the hooks' current state
  const gateway = new ClerkAuthGateway(clerkAuth, clerkUser, clerkSignIn, clerkSignUp);

  /**
   * Anatomical heart hero.
   *
   * Pure black background on the canvas allows this to blend perfectly,
   * removing any container edges.
   */
  const heart = useVideoPlayer(require('../../../assets/video/heart.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Form states
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // UI Toggles
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  // Auto-calculate age if valid date of birth (YYYY-MM-DD)
  const handleDobChange = (val: string) => {
    setDob(val);
    const parts = val.split(/[-/]/);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const birthDate = new Date(year, month, day);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0 && calculatedAge < 120) {
          setAge(calculatedAge.toString());
        }
      }
    }
  };

  const isSignInValid = email.includes('@') && pw.length >= 8;
  const isSignUpValid =
    fullName.trim().length > 0 &&
    dob.trim().length > 0 &&
    email.includes('@') &&
    pw.length >= 8 &&
    pw === confirmPw &&
    agreeTerms;

  const valid = mode === 'in' ? isSignInValid : isSignUpValid;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const s = mode === 'in'
        ? await gateway.signIn(email, pw)
        : await gateway.signUp(email, pw);
      onDone(s);
    } catch (e: any) {
      setErr(e.message || 'Authentication failed. Please check your credentials and try again.');
    } finally { setBusy(false); }
  }

  async function handleGoogleLogin() {
    setBusy(true); setErr(null);
    try {
      // Logic for Google OAuth with Clerk would go here
      // Placeholder for now
      setErr('Google OAuth requires further configuration on your machine.');
    } finally { setBusy(false); }
  }

  const fieldStyle = (key: string) => [
    st.pillInput,
    {
      borderColor: focused === key ? P.accent : '#E2E8F0',
      backgroundColor: '#F8FAFC',
      color: '#0F172A',
      ...TYPE.body,
    },
  ];

  /* ──────────────────────────  WELCOME / SPLASH SCREEN  ────────────────────────── */
  if (mode === 'welcome') {
    // Hero responsive sizing: 60% of screen width
    const heroW = Math.round(width * 0.6);
    const heroH = Math.round(heroW * (1280 / 720));

    return (
      <View style={st.darkCanvas}>
        <View pointerEvents="none" style={[st.bubble, st.bubbleTop]} />
        <View pointerEvents="none" style={[st.bubble, st.bubbleMid]} />
        <View pointerEvents="none" style={[st.bubble, st.bubbleBottom]} />

        <View style={st.brandRow}>
          <View style={st.brandMark}>
            <Icon name="pulse" size={20} color="#FFFFFF" />
          </View>
          <Txt t="heading" c="#F8FAFC" style={st.brandWord}>
            Pulse<Txt t="heading" c="#8FA0FF" style={st.brandWord}>Point</Txt>
          </Txt>
        </View>
        <Txt t="micro" c="#7C8AA8" style={st.brandEyebrow}>
          CLINICAL INTELLIGENCE
        </Txt>

        <View style={st.heroHeadlineSection}>
          <Txt t="display" c="#FFFFFF" style={st.heroHeadlineText}>
            Control & Monitor Your Health in One Place
          </Txt>
        </View>

        {/* Beating-heart hero.
            Pure black background and removed borders allow the video to float. */}
        <View style={st.heroGraphicWrapper}>
          <View style={[st.heroFrame, { width: heroW, height: heroH }]}>
            <VideoView
              player={heart}
              style={st.heroVideo}
              contentFit="contain"
              nativeControls={false}
              allowsPictureInPicture={false}
              allowsFullscreen={false}
            />
          </View>
        </View>

        <View style={st.welcomeFooter}>
          <SlideToStart onComplete={() => setMode('in')} />
        </View>
      </View>
    );
  }

  /* ──────────────────────────  SIGN IN & SIGN UP CARD UI  ────────────────────────── */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#EFF3F8' }}
      contentContainerStyle={{ paddingBottom: S.huge, paddingTop: S.lg }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={st.topHeaderBar}>
        <TouchableOpacity
          onPress={() => setMode('welcome')}
          style={st.headerBackCircle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevronLeft" size={20} color="#334155" />
        </TouchableOpacity>
        <Txt t="display" c="#2563EB" style={{ fontSize: 24, fontWeight: '800' }}>
          PulsePoint
        </Txt>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ paddingHorizontal: S.lg }}>
        <Enter index={1}>
          <View style={st.smartCard}>
            <Txt t="display" c="#0F172A" center style={{ fontSize: 22, fontWeight: '700', marginBottom: S.xl }}>
              {mode === 'in' ? 'Welcome back login now!' : 'Create an Account?'}
            </Txt>

            {mode === 'up' ? (
              <>
                <Txt t="label" c="#334155" style={{ marginBottom: S.xs }}>Name</Txt>
                <TextInput
                  style={fieldStyle('fullName')}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocused('fullName')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="words"
                  placeholder="Johan orindo"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
                  <View style={{ flex: 2 }}>
                    <Txt t="label" c="#334155" style={{ marginBottom: S.xs }}>Date of birth</Txt>
                    <TextInput
                      style={fieldStyle('dob')}
                      value={dob}
                      onChangeText={handleDobChange}
                      onFocus={() => setFocused('dob')}
                      onBlur={() => setFocused(null)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt t="label" c="#334155" style={{ marginBottom: S.xs }}>Age</Txt>
                    <TextInput
                      style={fieldStyle('age')}
                      value={age}
                      onChangeText={setAge}
                      onFocus={() => setFocused('age')}
                      onBlur={() => setFocused(null)}
                      keyboardType="numeric"
                      placeholder="28"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </>
            ) : null}

            <Txt t="label" c="#334155" style={{ marginTop: S.md, marginBottom: S.xs }}>Email</Txt>
            <TextInput
              style={fieldStyle('email')}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="joedoe75@gmail.com"
              placeholderTextColor="#94A3B8"
            />

            <Txt t="label" c="#334155" style={{ marginTop: S.md, marginBottom: S.xs }}>Password</Txt>
            <View style={st.passwordWrapper}>
              <TextInput
                style={[fieldStyle('pw'), { paddingRight: 48 }]}
                value={pw}
                onChangeText={setPw}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={st.eyeButton}
                onPress={() => setShowPw(!showPw)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name={showPw ? 'eye' : 'eyeOff'} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {mode === 'up' ? (
              <>
                <Txt t="label" c="#334155" style={{ marginTop: S.md, marginBottom: S.xs }}>Confirm Password</Txt>
                <View style={st.passwordWrapper}>
                  <TextInput
                    style={[fieldStyle('confirmPw'), { paddingRight: 48 }]}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    onFocus={() => setFocused('confirmPw')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPw}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={st.eyeButton}
                    onPress={() => setShowPw(!showPw)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Icon name={showPw ? 'eye' : 'eyeOff'} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {confirmPw.length > 0 && confirmPw !== pw ? (
                  <Txt t="caption" c={P.danger} style={{ marginTop: 4 }}>
                    Passwords do not match.
                  </Txt>
                ) : null}
              </>
            ) : null}

            {mode === 'in' ? (
              <View style={st.optionsRow}>
                <TouchableOpacity
                  style={st.checkboxRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View style={[st.checkboxSquare, rememberMe && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
                    {rememberMe ? <Icon name="check" size={12} color="#FFFFFF" weight="bold" /> : null}
                  </View>
                  <Txt t="caption" c="#64748B">Remember me</Txt>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7}>
                  <Txt t="caption" c="#2563EB" style={{ fontWeight: '600' }}>Forgot password?</Txt>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[st.checkboxRow, { marginTop: S.lg }]}
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.8}
              >
                <View style={[st.checkboxSquare, agreeTerms && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
                  {agreeTerms ? <Icon name="check" size={12} color="#FFFFFF" weight="bold" /> : null}
                </View>
                <Txt t="caption" c="#64748B" style={{ flex: 1 }}>
                  I agree to the <Txt t="caption" c="#2563EB" style={{ fontWeight: '600' }}>Terms of Service</Txt>
                </Txt>
              </TouchableOpacity>
            )}

            {err ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: S.md }}>
                <Icon name="alert" size={15} color={P.danger} />
                <Txt t="caption" c={P.danger}>{err}</Txt>
              </View>
            ) : null}

            <View style={{ marginTop: S.xl }}>
              <TouchableOpacity
                style={[st.primaryButton, !valid && { opacity: 0.55 }]}
                disabled={!valid || busy}
                onPress={submit}
                activeOpacity={0.88}
              >
                <Txt t="heading" c="#FFFFFF" style={{ fontSize: 16, fontWeight: '700' }}>
                  {busy ? 'Working…' : mode === 'in' ? 'Login' : 'Create account'}
                </Txt>
              </TouchableOpacity>
            </View>

            <View style={st.dividerWrapper}>
              <View style={st.dividerLine} />
              <Txt t="caption" c="#94A3B8" style={{ paddingHorizontal: S.md }}>Or Sign in with</Txt>
              <View style={st.dividerLine} />
            </View>

            <View style={st.socialRow}>
              <TouchableOpacity
                style={st.googlePillButton}
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
              >
                <Icon name="google" size={22} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setMode(mode === 'in' ? 'up' : 'in');
                setErr(null);
              }}
              style={{ marginTop: S.xl, alignItems: 'center' }}
            >
              <Txt t="label" c="#2563EB" style={{ fontWeight: '600' }}>
                {mode === 'in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
              </Txt>
            </TouchableOpacity>
          </View>
        </Enter>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  darkCanvas: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingVertical: S.xxl,
    overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999 },
  bubbleTop:    { width: 460, height: 460, top: -210, left: -170, backgroundColor: '#3A46E8', opacity: 0.15 },
  bubbleMid:    { width: 300, height: 300, top: 210,  right: -140, backgroundColor: '#38BDF8', opacity: 0.08 },
  bubbleBottom: { width: 420, height: 420, bottom: -200, right: -130, backgroundColor: '#3A46E8', opacity: 0.12 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: S.sm, paddingTop: S.lg,
  },
  brandMark: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3A46E8',
  },
  brandWord: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  brandEyebrow: {
    textAlign: 'center', marginTop: 6, letterSpacing: 3.2, textTransform: 'uppercase',
  },
  heroGraphicWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: S.md,
  },
  heroFrame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  heroVideo: { width: '100%', height: '100%' },
  heroHeadlineSection: {
    paddingHorizontal: S.xl,
    marginTop: S.lg,
  },
  heroHeadlineText: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  welcomeFooter: {
    paddingHorizontal: S.xl,
    marginBottom: S.lg,
  },
  startPillButton: {
    height: 60,
    backgroundColor: '#2563EB',
    borderRadius: R.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    position: 'relative',
    overflow: 'hidden',
  },
  startIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.xl,
    marginBottom: S.lg,
  },
  headerBackCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: S.xl,
    paddingVertical: S.xxl,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pillInput: {
    height: 52,
    borderRadius: R.pill,
    borderWidth: 1,
    paddingHorizontal: S.xl,
    justifyContent: 'center',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: S.lg,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  primaryButton: {
    height: 54,
    borderRadius: R.pill,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: S.xxl,
    marginBottom: S.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googlePillButton: {
    width: 60,
    height: 52,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
