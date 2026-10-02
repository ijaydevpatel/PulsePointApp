import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, BackHandler, StatusBar, useColorScheme, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular, PlayfairDisplay_500Medium,
} from '@expo-google-fonts/playfair-display';
// @ts-ignore
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';

import { TriageResult, BAND_LABEL } from '../domain/entities';
import { InteractionReport } from '../domain/medicines';
import { Session, GUEST } from '../domain/auth';
import { ActivityKind } from '../domain/activity';
import { readFacilityCache, writeFacilityCache } from '../data/facilityCache';
import { SymptomAnalysis, MedicineCheck, RemoteOutcome } from '../domain/remote';
import { RuleClassifier } from '../data/ruleClassifier';
import { DurableEpisodeStore } from '../data/episodeStore';
import { tokenCache } from '../data/clerkAuth';
import { createServices } from '../data/services';
import { Fix, resolveFix } from '../data/locationFix';
import { ENV } from '../config/env';

import { TabBar } from './nav/TabBar';
import { TopBar } from './nav/TopBar';
import { TabTransition } from './nav/TabTransition';
import { DEFAULT_TAB, RouteKey, TabKey } from './nav/routes';
import { OfflineBanner } from './components/ScreenHeader';
import { BottomScrim } from './components/BottomScrim';
import { TriageScreen } from './screens/TriageScreen';
import { ResultScreen } from './screens/ResultScreen';
import { MedicinesScreen } from './screens/MedicinesScreen';
import { CollisionScreen } from './screens/CollisionScreen';
import { CareScreen } from './screens/CareScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ChatScreen, Conversation, EMPTY_CONVERSATION } from './screens/ChatScreen';
import { NewsScreen } from './screens/NewsScreen';
import { CheckInScreen } from './screens/SimpleScreens';
import { ThemeContext, buildTheme, Scheme } from './theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

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

  const store = useMemo(() => new DurableEpisodeStore(), []);

  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const services = useMemo(() => createServices(() => tokenRef.current()), []);

  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB);
  const [stack, setStack] = useState<RouteKey[]>([]);
  const [result, setResult] = useState<{ r: TriageResult; ms: number } | null>(null);

  const [analysis, setAnalysis] = useState<RemoteOutcome<SymptomAnalysis> | null>(null);
  const [report, setReport] = useState<InteractionReport | null>(null);

  const [pair, setPair] = useState<[string, string]>(['', '']);

  const [check, setCheck] = useState<RemoteOutcome<MedicineCheck> | null | undefined>(undefined);
  const [historyKey, setHistoryKey] = useState(0);

  const [conversation, setConversation] = useState<Conversation>(EMPTY_CONVERSATION);

  const [fix, setFix] = useState<Fix | null>(null);
  useEffect(() => {
    let alive = true;
    void resolveFix().then((f) => { if (alive) setFix(f); });
    return () => { alive = false; };
  }, []);
  const [offline] = useState(false);

  useEffect(() => { void store.init(); }, [store]);

  useEffect(() => {
    if (!fix) return;
    if (readFacilityCache(fix.lat, fix.lon)) return;

    let alive = true;
    const timer = setTimeout(() => {
      void services.facilities
        .near({ lat: fix.lat, lon: fix.lon, radiusDeg: 0.012 })
        .then((r) => {
          if (alive && r.ok) writeFacilityCache(fix.lat, fix.lon, r.facilities);
        })
        .catch(() => {});
    }, 2500);

    return () => { alive = false; clearTimeout(timer); };
  }, [fix, services]);

  const ready = fontsLoaded || !!fontError;

  const log = useCallback((
    kind: ActivityKind,
    title: string,
    detail: string | null = null,
    episodeId: string | null = null,
  ) => {
    void store.record({ kind, title, detail, episodeId, at: new Date().toISOString() });
  }, [store]);

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
    const clerkName =
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      null;
    return {
      state: 'SIGNED_IN',
      userId: user.id,
      displayName: clerkName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You',
      cachedAt: new Date().toISOString(),
    };
  }, [authLoaded, userLoaded, isSignedIn, user]);

  const [waitedForAuth, setWaitedForAuth] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedForAuth(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const booted = ready && (waitedForAuth || (authLoaded && userLoaded));

  useEffect(() => {
    if (booted) void SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  if (!booted) {
    return (
      <View style={[s.root, { backgroundColor: scheme === 'dark' ? '#12263A' : '#FFFFFF' }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      </View>
    );
  }

  if (session.state === 'GUEST') {
    return (
      <View style={[s.root, { backgroundColor: theme.c.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AuthScreen
          onEnterApp={() => {  }}
          onDone={() => {  }}
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
        return <CollisionScreen pair={pair} check={check} onBack={pop} onEdit={pop} />;
      case 'profile':
        return (
          <ProfileScreen
            session={session}
            service={services.profile}
            onBack={pop}

            onOpen={(r) => setStack((st) => [...st.slice(0, -1), r])}
            onSignOut={async () => {
              await signOut();
              setStack([]);

              setConversation(EMPTY_CONVERSATION);
            }}
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
          <SettingsScreen
            session={session}
            store={store}
            scheme={scheme}
            historyKey={historyKey}
            onDataCleared={() => setHistoryKey((k) => k + 1)}
            onToggleScheme={() => setOverride(scheme === 'dark' ? 'light' : 'dark')}
            onBack={pop}
            onOpen={(r) => setStack((st) => [...st.slice(0, -1), r])}
            onSignOut={async () => {
              await signOut();
              setStack([]);
              setConversation(EMPTY_CONVERSATION);
            }}
          />
        );
      case 'records':   return <RecordsScreen store={store} refreshKey={historyKey} onBack={pop} />;
      case 'chat':      return (
        <ChatScreen
          service={services.chat} onBack={pop}
          conversation={conversation} onConversation={setConversation}
        />
      );
      case 'news':      return <NewsScreen service={services.news} onBack={pop} />;
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
            profile={services.profile}
            onStartTriage={() => setTab('triage')}
          />
        );
      case 'triage':
        return (
          <TriageScreen
            classifier={classifier} store={store}
            analysis={services.symptoms}
            profile={services.profile}

            onResult={(r, ms) => {
              setAnalysis(null);
              setResult({ r, ms });
              push('result');
            }}
            onSaved={(r) => {
              // The record is on disk and complete, so it can be listed and logged.
              setHistoryKey((k) => k + 1);

              void store.get(r.episodeId).then((entry) => {
                const names = entry?.episode.symptoms.map((x) => x.label) ?? [];
                log(
                  'SYMPTOM_CHECK',
                  names.length ? names.join(', ') : 'Symptom check',
                  `${BAND_LABEL[r.band]} · ${r.severity}/100`,
                  r.episodeId,
                );
              });
            }}
            onAnalysis={setAnalysis}
          />
        );
      case 'medicines':
        return (
          <MedicinesScreen
            check={services.medicines}
            onRun={(p) => {
              setPair(p);
              push('interactions');
              log('MEDICINE_CHECK', `${p[0]} and ${p[1]}`);
            }}

            onCheck={setCheck}
          />
        );

      case 'chat':      return (
        <ChatScreen
          service={services.chat}
          conversation={conversation} onConversation={setConversation}
        />
      );
      case 'care':      return (
        <CareScreen
          service={services.facilities}
          fix={fix}
          onSearched={(count, place) => log(
            'CARE_SEARCH',
            place ? `Care near ${place}` : 'Care near you',
            `${count} place${count === 1 ? '' : 's'} found`,
          )}
        />
      );
    }
  }

  const overlay = renderTop();

  return (
    <ThemeContext.Provider value={theme}>
      <>
        <View style={[s.root, { backgroundColor: theme.c.bg }]}>
          <SafeAreaView style={s.root} edges={['top']}>
            <StatusBar
              barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor="transparent"
              translucent
            />
            <OfflineBanner visible={offline} />
            <View style={{ flex: 1 }}>
              {overlay ?? <TabTransition tabKey={tab}>{renderTab()}</TabTransition>}
            </View>
            {overlay ? null : (
              <>
                <TopBar session={session} onOpenProfile={() => push('profile')} />
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

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AppContent />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
