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
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, BackHandler, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { TriageResult } from '../domain/entities';
import { Session, GUEST } from '../domain/auth';
import { RuleClassifier } from '../data/ruleClassifier';
import { InMemoryEpisodeStore } from '../data/memoryStore';
import { FakeAuthGateway } from '../data/fakeAuth';

import { TabBar } from './nav/TabBar';
import { DEFAULT_TAB, RouteKey, TabKey } from './nav/routes';
import { OfflineBanner } from './components/ScreenHeader';
import { TriageScreen } from './screens/TriageScreen';
import { ResultScreen } from './screens/ResultScreen';
import { MedicinesScreen } from './screens/MedicinesScreen';
import { CareScreen } from './screens/CareScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { AuthScreen } from './screens/AuthScreen';
import {
  CheckInScreen, DocumentsScreen, NewsScreen, ChatScreen, ProfileScreen,
} from './screens/SimpleScreens';
import { C } from './theme';

export default function App() {
  // Phase 2 note: swap InMemoryEpisodeStore for SqliteEpisodeStore on device.
  // Both satisfy EpisodeStore, so nothing above the data layer changes.
  const classifier = useMemo(() => new RuleClassifier(), []);
  const store = useMemo(() => new InMemoryEpisodeStore(), []);
  const auth = useMemo(() => new FakeAuthGateway(), []);

  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB);
  const [stack, setStack] = useState<RouteKey[]>([]);
  const [session, setSession] = useState<Session>(GUEST);
  const [result, setResult] = useState<{ r: TriageResult; ms: number } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [offline] = useState(false); // Phase 9 wires ConnectivityMonitor here

  useEffect(() => { void store.init(); }, [store]);

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
      case 'medicines': return <MedicinesScreen />;
      case 'care':      return <CareScreen />;
      case 'records':   return <RecordsScreen store={store} refreshKey={historyKey} />;
      case 'more':      return <MoreScreen session={session} onOpen={push} />;
    }
  }

  const overlay = renderTop();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <OfflineBanner visible={offline} />
        <View style={{ flex: 1 }}>{overlay ?? renderTab()}</View>
        {overlay ? null : <TabBar active={tab} onSelect={(k) => { setStack([]); setTab(k); }} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg } });
