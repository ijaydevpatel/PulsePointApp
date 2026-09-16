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
import { DEFAULT_TAB, RouteKey, TabKey } from './nav/routes';
import { OfflineBanner } from './components/ScreenHeader';
import { BottomScrim } from './components/BottomScrim';
import { TriageScreen } from './screens/TriageScreen';
import { ResultScreen } from './screens/ResultScreen';
import { MedicinesScreen } from './screens/MedicinesScreen';
import { InteractionScreen } from './screens/InteractionScreen';
import { CareScreen } from './screens/CareScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewsScreen } from './screens/NewsScreen';
import { AnalyzerScreen } from './screens/AnalyzerScreen';
import { CheckInScreen, ProfileScreen } from './screens/SimpleScreens';
import { ThemeContext, buildTheme, Scheme } from './theme';

function AppContent() {
  const { isLoaded: authLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
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

  if (session.state === 'GUEST') {
    return (
      <View style={[s.root, { backgroundColor: theme.c.bg }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <AuthScreen
          onBack={() => {}}
          onDone={() => { /* Clerk hooks will trigger re-render */ }}
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
          <ProfileScreen
            session={session} onBack={pop}
            onSignIn={() => push('auth')}
            onSignOut={async () => { await signOut(); }}
          />
        );
      case 'auth':
        return (
          <AuthScreen
            onBack={pop}
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
      case 'checkin':   return <CheckInScreen onBack={pop} />;
      // chat, news and documents are tab roots now — they render in renderTab
      // below, not here. Leaving push cases for them would give two ways to
      // reach one screen, one of which draws a back chevron that pops to
      // whatever happened to be underneath.
      default:          return null;
    }
  }

  function renderTab() {
    switch (tab) {
      case 'triage':
        return (
          <TriageScreen
            classifier={classifier} store={store}
            analysis={services.symptoms}
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
      case 'care':      return <CareScreen />;
      case 'records':   return <RecordsScreen store={store} refreshKey={historyKey} />;
      case 'chat':      return <ChatScreen service={services.chat} />;
      case 'news':      return <NewsScreen service={services.news} />;
      case 'documents': return <AnalyzerScreen service={services.reports} />;
    }
  }

  const overlay = renderTop();

  return (
    <ThemeContext.Provider value={theme}>
      <SafeAreaProvider>
        <SafeAreaView style={[s.root, { backgroundColor: theme.c.bg }]} edges={['top']}>
          <StatusBar
            barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />
          <OfflineBanner visible={offline} />
          <View style={{ flex: 1 }}>{overlay ?? renderTab()}</View>
          {overlay ? null : (
            <>
              <BottomScrim />
              <TabBar active={tab} onSelect={(k) => { setStack([]); setTab(k); }} />
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
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

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppContent />
    </ClerkProvider>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
