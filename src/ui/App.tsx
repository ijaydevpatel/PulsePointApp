/**
 * App shell.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, BackHandler, StatusBar, useColorScheme, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular, PlayfairDisplay_500Medium,
} from '@expo-google-fonts/playfair-display';
// @ts-ignore
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';

import { TriageResult } from '../domain/entities';
import { InteractionReport } from '../domain/medicines';
import { Session, GUEST } from '../domain/auth';
import { SymptomAnalysis, RemoteOutcome } from '../domain/remote';
import { RuleClassifier } from '../data/ruleClassifier';
import { InMemoryEpisodeStore } from '../data/memoryStore';
import { tokenCache } from '../data/clerkAuth';
import { createServices } from '../data/services';
import { ENV } from '../config/env';

import { TabBar } from './nav/TabBar';
import { TopBar } from './nav/TopBar';
import { TabTransition } from './nav/TabTransition';
import { DEFAULT_TAB, RouteKey, TabKey } from './nav/routes';
import { OfflineBanner } from './components/ScreenHeader';
import { BottomScrim } from './components/BottomScrim';
import { GlassBackground } from './components/LiquidGlass';
import { TriageScreen } from './screens/TriageScreen';
import { ResultScreen } from './screens/ResultScreen';
import { MedicinesScreen } from './screens/MedicinesScreen';
import { InteractionScreen } from './screens/InteractionScreen';
import { CareScreen } from './screens/CareScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileSheet } from './screens/ProfileSheet';
import { ChatScreen } from './screens/ChatScreen';
import { NewsScreen } from './screens/NewsScreen';
import { AnalyzerScreen } from './screens/AnalyzerScreen';
import { CheckInScreen } from './screens/SimpleScreens';
import { ThemeContext, buildTheme, Scheme } from './theme';

function AppContent() {
  const { isLoaded: authLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
    PlayfairDisplay_400Regular, PlayfairDisplay_500Medium,
  });

  const osScheme = useColorScheme();
  const [override, setOverride] = useState<Scheme | null>(null);
  const scheme: Scheme = override ?? (osScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  const classifier = useMemo(() => new RuleClassifier(), []);
  const store = useMemo(() => new InMemoryEpisodeStore(), []);

  /**
   * Every hosted feature, built once and handed Clerk's token function.
   *
   * getToken is read per request, not captured: session JWTs are short-lived,
   * so a value grabbed at startup would be stale by the time someone asks for
   * an analysis. Clerk keeps getToken referentially stable, so this memo does
   * not churn on every render.
   */
  const services = useMemo(() => createServices(() => getToken()), [getToken]);

  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB);
  const [stack, setStack] = useState<RouteKey[]>([]);
  const [result, setResult] = useState<{ r: TriageResult; ms: number } | null>(null);
  /**
   * The hosted matrix for the current episode. Null while it is in flight, so
   * the result screen can show the local band immediately and fill in the five
   * ranked conditions when they arrive.
   */
  const [analysis, setAnalysis] = useState<RemoteOutcome<SymptomAnalysis> | null>(null);
  const [report, setReport] = useState<InteractionReport | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [offline] = useState(false);

  useEffect(() => { void store.init(); }, [store]);

  const ready = fontsLoaded || !!fontError;

  const push = useCallback((r: RouteKey) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) { pop(); return true; }
      if (tab !== DEFAULT_TAB) { setTab(DEFAULT_TAB); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab, pop]);

  const session: Session = useMemo(() => {
    if (!authLoaded || !userLoaded || !isSignedIn || !user) return GUEST;
    return {
      state: 'SIGNED_IN',
      userId: user.id,
      displayName: user.fullName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You',
      cachedAt: new Date().toISOString(),
    };
  }, [authLoaded, userLoaded, isSignedIn, user]);

  if (!ready || !authLoaded || !userLoaded) {
    return (
      <View style={[s.root, { backgroundColor: theme.c.bg }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      </View>
    );
  }

  /*
   * No session means the onboarding flow, which opens on its welcome screen
   * and ends when Clerk reports a session. A restored session skips the whole
   * thing and lands on the tabs, which is why this is a plain guest check
   * rather than an onboarding flag: welcome is the door, not a reward, and
   * someone who is already inside should not be shown the door again.
   */
  if (session.state === 'GUEST') {
    return (
      <View style={[s.root, { backgroundColor: theme.c.bg }]}>
        {/* The auth composition is a fixed light one, so its status bar icons
            are dark regardless of the OS theme. */}
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AuthScreen
          onEnterApp={() => { /* Clerk's session change drives the swap */ }}
          onDone={() => { /* Clerk hooks drive the re-render */ }}
        />
      </View>
    );
  }

  const top = stack[stack.length - 1];

  function renderTop() {
    switch (top) {
      case 'result':
        return result ? (
          <ResultScreen
            result={result.r} elapsedMs={result.ms}
            analysis={analysis}
            onBack={pop}
            onFindCare={() => { setStack([]); setTab('care'); }}
          />
        ) : null;
      case 'interactions':
        return report ? (
          <InteractionScreen report={report} onBack={pop} onEdit={pop} />
        ) : null;
      case 'profile':
        return (
          <ProfileSheet
            session={session}
            onBack={pop}
            // Replaces the current sheet rather than stacking on it, so
            // backing out of Records returns to the screen behind the sheet
            // instead of to the sheet itself.
            onOpen={(r) => setStack((st) => [...st.slice(0, -1), r])}
            onSignOut={async () => { await signOut(); setStack([]); }}
          />
        );
      case 'auth':
        return (
          <AuthScreen
            initialMode="login"
            onEnterApp={pop}
            onDone={() => { setStack([]); }}
          />
        );
      case 'settings':
        return (
          <MoreScreen
            session={session}
            onOpen={push}
            scheme={scheme}
            onToggleScheme={() => setOverride(scheme === 'dark' ? 'light' : 'dark')}
          />
        );
      case 'records':   return <RecordsScreen store={store} refreshKey={historyKey} onBack={pop} />;
      case 'chat':      return <ChatScreen service={services.chat} onBack={pop} />;
      case 'news':      return <NewsScreen service={services.news} onBack={pop} />;
      case 'documents': return <AnalyzerScreen service={services.reports} onBack={pop} />;
      case 'checkin':   return <CheckInScreen onBack={pop} />;
      default:          return null;
    }
  }

  function renderTab() {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            store={store}
            session={session}
            refreshKey={historyKey}
            dashboard={services.dashboard}
            conditions={services.conditions}
            onStartTriage={() => setTab('triage')}
          />
        );
      case 'triage':
        return (
          <TriageScreen
            classifier={classifier} store={store}
            analysis={services.symptoms}
            profile={services.profile}
            // Cleared on every new assessment so the result screen never shows
            // the previous episode's matrix while this one is still in flight.
            onResult={(r, ms) => {
              setAnalysis(null);
              setResult({ r, ms });
              setHistoryKey((k) => k + 1);
              push('result');
            }}
            onAnalysis={setAnalysis}
          />
        );
      case 'medicines':
        return (
          <MedicinesScreen
            onReport={(r) => { setReport(r); push('interactions'); }}
          />
        );
      case 'documents': return <AnalyzerScreen service={services.reports} />;
      case 'care':      return <CareScreen />;
    }
  }

  const overlay = renderTop();

  return (
    <ThemeContext.Provider value={theme}>
      {/* SafeAreaProvider lives at the root now — see the note on App(). */}
      <>
        <View style={[s.root, { backgroundColor: theme.c.bg }]}>
          <GlassBackground />
          <SafeAreaView style={s.root} edges={['top']}>
            <StatusBar
              barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor="transparent"
              translucent
            />
            <OfflineBanner visible={offline} />
            {/*
              No key on TabTransition. Keying it on the tab remounted the
              component on every switch, which reset its "previous tab" ref to
              the tab it was already showing — so it always measured a
              zero-length move and skipped the animation entirely. It has to
              survive the change in order to animate it; the children swap on
              their own because renderTab() returns a different element.
            */}
            <View style={{ flex: 1 }}>
              {overlay ?? <TabTransition tabKey={tab}>{renderTab()}</TabTransition>}
            </View>
            {overlay ? null : (
              <>
                {/* Floating chrome. Both bars sit above the content rather
                    than reserving bands of their own, so the screen underneath
                    scrolls the full height. */}
                <TopBar
                  session={session}
                  onOpenProfile={() => push('profile')}
                  onOpenHome={tab === 'home' ? undefined : () => setTab('home')}
                />
                <BottomScrim />
                <TabBar active={tab} onSelect={(k) => { setStack([]); setTab(k); }} />
              </>
            )}
          </SafeAreaView>
        </View>
      </>
    </ThemeContext.Provider>
  );
}

export default function App() {
  const publishableKey = ENV.clerkPublishableKey;

  if (!publishableKey) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Configuration Missing</Text>
        <Text style={{ textAlign: 'center' }}>
          Please add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file and restart the app.
        </Text>
      </View>
    );
  }

  /*
   * SafeAreaProvider wraps everything, above the auth gate rather than below
   * it.
   *
   * It used to sit inside AppContent's signed-in return, which meant the auth
   * and onboarding branch — which returns earlier — rendered with no provider
   * above it. Any useSafeAreaInsets() call down there threw on mount. Insets
   * matter most on exactly those screens, since they draw edge to edge, so the
   * provider belongs at the root where every branch can see it.
   */
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AppContent />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
