import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { TABS, TabKey } from './routes';
import { useReveal } from '../useReveal';

const SLIDE = 24;
const DURATION = 220;

const indexOf = (k: TabKey): number => TABS.findIndex((t) => t.key === k);

export function TabTransition({
  tabKey, children,
}: {
  tabKey: TabKey;
  children: React.ReactNode;
}) {
  const { value: progress, play, settle, finished } = useReveal();
  const previous = useRef<TabKey>(tabKey);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (alive) setReduceMotion(r); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const direction = useRef(1);

  useEffect(() => {
    const from = indexOf(previous.current);
    const to = indexOf(tabKey);
    previous.current = tabKey;

    if (from === -1 || to === -1 || from === to) {
      settle();
      return;
    }

    direction.current = to > from ? 1 : -1;
    play({ duration: DURATION });
  }, [tabKey, play, settle]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SLIDE * direction.current, 0],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        finished
          ? null
          : { opacity: progress, transform: reduceMotion ? [] : [{ translateX }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
