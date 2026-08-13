/**
 * App shell.
 *
 * No landing screen: the app opens on Triage because the first screen should be
 * the task. Navigation is a tab set plus a small push stack, held here so the
 * structure matches the navigation graph in the report exactly.
 *
 * Dependency wiring also happens here — it is the only place that knows which
 * concrete Classifier, EpisodeStore and AuthGateway are in use, which is what
 * lets Phase 7 swap the rules engine for TFLite by changing one line.
 *
 * Two presentation concerns also live here because they are genuinely global:
 * the typeface must finish loading before anything paints (otherwise the app
 * flashes in the system font and reflows), and the colour scheme follows the
 * OS with a manual override, so the theme is provided from a single root.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, BackHandler, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
} from '@expo-google-fonts/inter';

import { TriageResult } from '../domain/entities';
import { InteractionReport } from '../domain/medicines';
import { Session, GUEST } from '../domain/auth';
import { RuleClassifier } from '../data/ruleClassifier';
import { InMemoryEpisodeStore } from '../data/memoryStore';
import { FakeAuthGateway } from '../data/fakeAuth';

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
import {
  CheckInScreen, DocumentsScreen, NewsScreen, ChatScreen, ProfileScreen,
} from './screens/SimpleScreens';
import { ThemeContext, buildTheme, Scheme } from './theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });

  const osScheme = useColorScheme();
  const [override, setOverride] = useState<Scheme | null>(null);
  const scheme: Scheme = override ?? (osScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  // Phase 2 note: swap InMemoryEpisodeStore for SqliteEpisodeStore on device.
  // Both satisfy EpisodeStore, so nothing above the data layer changes.
  const classifier = useMemo(() => new RuleClassifier(), []);
  const store = useMemo(() => new InMemoryEpisodeStore(), []);
  const auth = useMemo(() => new FakeAuthGateway(), []);

  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB);
  const [stack, setStack] = useState<RouteKey[]>([]);
  const [session, setSession] = useState<Session>(GUEST);
  const [result, setResult] = useState<{ r: TriageResult; ms: number } | null>(null);
  const [report, setReport] = useState<InteractionReport | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [offline] = useState(false); // Phase 9 wires ConnectivityMonitor here

  useEffect(() => { void store.init(); }, [store]);

  // Hold until the typeface is ready, so the app never paints in the system
  // font and then reflows. A font error must not brick the app — falling
  // through to the system font is worse-looking but still usable.
  const ready = fontsLoaded || !!fontError;

  const push = useCallback((r: RouteKey) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  // Android hardware back maps onto the same stack the graph describes.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) { pop(); return true; }
      if (tab !== DEFAULT_TAB) { setTab(DEFAULT_TAB); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab, pop]);

  // Branded hold rather than a blank frame. Bundled fonts resolve in well
  // under a second, so this is a colour match rather than a real screen.
  if (!ready) {
    return (
      <View style={[s.root, { backgroundColor: theme.c.bg }]}>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
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
            onSignIn={() => push('more')}
            onSignOut={async () => { await auth.signOut(); setSession(GUEST); }}
          />
        );
      case 'more':
        return (
          <AuthScreen gateway={auth} onBack={pop}
            onDone={(s) => { setSession(s); setStack([]); }} />
        );
      case 'checkin':   return <CheckInScreen onBack={pop} />;
      case 'documents': return <DocumentsScreen onBack={pop} />;
      case 'news':      return <NewsScreen onBack={pop} />;
      case 'chat':      return <ChatScreen onBack={pop} />;
      default:          return null;
    }
  }

  function renderTab() {
    switch (tab) {
      case 'triage':
        return (
          <TriageScreen
            classifier={classifier} store={store}
            onResult={(r, ms) => { setResult({ r, ms }); setHistoryKey((k) => k + 1); push('result'); }}
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
      case 'more':
        return (
          <MoreScreen
            session={session}
            onOpen={push}
            scheme={scheme}
            onToggleScheme={() => setOverride(scheme === 'dark' ? 'light' : 'dark')}
          />
        );
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
          {/*
            Scrim then bar, in that order, so the fade sits behind the glass.
            Only rendered alongside the tab bar — an overlay screen runs to the
            bottom edge and has nothing to fade out.
          */}
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

const s = StyleSheet.create({ root: { flex: 1 } });
