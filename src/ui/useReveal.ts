import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export interface RevealConfig {
  duration: number;
  delay?: number;
  easing?: (value: number) => number;
}

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass?: number;
  delay?: number;
}

const isSpring = (c: RevealConfig | SpringConfig): c is SpringConfig =>
  (c as SpringConfig).stiffness !== undefined;

export interface RevealOptions {
  native?: boolean;
}

export function useReveal(from = 0, to = 1, options: RevealOptions = {}) {
  const native = options.native ?? false;
  const value = useRef(new Animated.Value(from)).current;
  const settled = useRef(from);
  const animating = useRef(false);

  const [finished, setFinished] = useState(from === to);

  useEffect(() => {
    if (!animating.current) value.setValue(settled.current);
  });

  const animateTo = useCallback((target: number, config: RevealConfig | SpringConfig) => {
    animating.current = true;

    const animation = isSpring(config)
      ? Animated.spring(value, {
        toValue: target,
        damping: config.damping,
        stiffness: config.stiffness,
        mass: config.mass ?? 1,
        delay: config.delay ?? 0,
        useNativeDriver: native,
      })
      : Animated.timing(value, {
        toValue: target,
        duration: config.duration,
        delay: config.delay ?? 0,
        easing: config.easing ?? Easing.out(Easing.cubic),
        useNativeDriver: native,
      });

    animation.start(({ finished: completed }) => {
      animating.current = false;
      if (!completed) return;

      settled.current = target;

      value.setValue(target);

      if (target === to) setFinished(true);
    });
    if (target !== to) setFinished(false);
  }, [value, to, native]);

  const play = useCallback((config: RevealConfig) => {
    value.setValue(from);
    settled.current = from;
    setFinished(false);
    animateTo(to, config);
  }, [value, from, to, animateTo]);

  const settle = useCallback(() => {
    animating.current = false;
    settled.current = to;
    value.setValue(to);
    setFinished(true);
  }, [value, to]);

  const set = useCallback((v: number) => {
    animating.current = false;
    settled.current = v;
    value.setValue(v);
  }, [value]);

  return useMemo(
    () => ({ value, play, animateTo, settle, set, finished }),
    [value, play, animateTo, settle, set, finished],
  );
}
