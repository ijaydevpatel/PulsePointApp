/**
 * Cross-fade and a short directional slide when the tab changes.
 *
 * ── Why direction matters ────────────────────────────────────────────────────
 *
 * The five tabs are a row, and moving between them is lateral movement. A
 * transition that always slides the same way tells the person nothing; one
 * that slides *from the side the tab sits on* reinforces where they are. So
 * the direction is taken from the tab order — going right to Map enters from
 * the right, coming back to Home enters from the left.
 *
 * ── Why the distance is small ────────────────────────────────────────────────
 *
 * 24dp, not a full screen width. A full slide implies the two screens are
 * adjacent pages you could swipe between, which these are not — there is no
 * gesture, and a tab bar is random access rather than sequential. The short
 * offset reads as "this is new content" without promising a swipe that does
 * not exist.
 *
 * ── Reduce motion ────────────────────────────────────────────────────────────
 *
 * Honoured by skipping the translate entirely and keeping only the fade. A
 * lateral slide is exactly the kind of movement the setting exists to stop,
 * but an instant cut between screens loses the sense that anything changed, so
 * the opacity crossfade stays.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { TABS, TabKey } from './routes';

/** How far the incoming screen travels. Deliberately short — see above. */
const SLIDE = 24;
const DURATION = 220;

const indexOf = (k: TabKey): number => TABS.findIndex((t) => t.key === k);

export function TabTransition({
  tabKey, children,
}: {
  /** Changing this is what drives the transition. */
  tabKey: TabKey;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef<TabKey>(tabKey);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (alive) setReduceMotion(r); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  /*
   * Direction is decided before the animation starts and held for its
   * duration. Reading tab order during the animation would give the wrong
   * answer if another change landed mid-flight.
   */
  const direction = useRef(1);

  useEffect(() => {
    const from = indexOf(previous.current);
    const to = indexOf(tabKey);
    previous.current = tabKey;

    // Unknown index on either side — nothing sensible to slide from.
    if (from === -1 || to === -1 || from === to) {
      progress.setValue(1);
      return;
    }

    direction.current = to > from ? 1 : -1;

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tabKey, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SLIDE * direction.current, 0],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: progress,
          transform: reduceMotion ? [] : [{ translateX }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
