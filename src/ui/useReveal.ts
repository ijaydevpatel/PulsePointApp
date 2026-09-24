/**
 * A native-driven reveal that survives re-renders.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────────
 *
 * `useNativeDriver: true` hands the animated value to the UI thread. The JS
 * side keeps its own copy, and the native side does not write back to it. So
 * a value that starts at 0 and is animated to 1 natively is *still 0 as far as
 * JavaScript knows* — and the moment anything re-renders the component, React
 * re-applies the style from that stale 0 and the content vanishes.
 *
 * Nothing brings it back, because the effect that started the animation has
 * already run and will not run again.
 *
 * This shipped three times in this codebase before it was understood:
 *
 *   Enter           every block on a screen, invisible after one keystroke
 *   TabTransition   the whole screen, invisible after the keyboard closed
 *                   (hiding it changes window height, which re-renders the
 *                   tree through useWindowDimensions in the bars)
 *   Rise            the same shape on the auth screens
 *   TriageScreen    the Continue button, which fades out again on the next
 *                   keystroke in the note box even though a symptom is picked
 *   TabBar          the selected tab's label, stuck at 35% opacity after a
 *                   re-render — the persistent version of the "label missing
 *                   while switching" glitch
 *   Tap             press scale, stuck at 0.97 if a render lands mid-press
 *
 * They looked like unrelated faults — "it disappears when I type", "it
 * disappears when I scroll", "the label flickers" — and were all one.
 *
 * ── How this fixes it ────────────────────────────────────────────────────────
 *
 * Two things, and both are needed:
 *
 *   `settled` records the value the animation finished on, and every render
 *   re-asserts it. A re-render can no longer resurrect a stale 0.
 *
 *   The completion callback also calls setValue, which pushes the final value
 *   back into the JS copy. Without that, `settled` would be right and the
 *   animated value still wrong.
 *
 * `animating` suppresses the re-assert mid-flight, so a render during the
 * animation does not snap it back to where it started.
 *
 * ── Two ways to drive it ─────────────────────────────────────────────────────
 *
 *   `play`      a one-way reveal: jump to `from`, animate to `to`.
 *   `animateTo` a value that moves both ways — a button that fades in when it
 *               becomes available and out again when it does not, a press
 *               scale. Same protection, no assumption about direction.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export interface RevealConfig {
  duration: number;
  delay?: number;
  easing?: (value: number) => number;
}

/** A spring instead of a duration, for movement that should feel physical. */
export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass?: number;
  delay?: number;
}

const isSpring = (c: RevealConfig | SpringConfig): c is SpringConfig =>
  (c as SpringConfig).stiffness !== undefined;

export function useReveal(from = 0, to = 1) {
  const value = useRef(new Animated.Value(from)).current;
  const settled = useRef(from);
  const animating = useRef(false);

  /*
   * No dependency array on purpose: this must run after every render, because
   * every render is an opportunity for React to re-apply the stale JS value.
   */
  useEffect(() => {
    if (!animating.current) value.setValue(settled.current);
  });

  /**
   * Animate to a target and record it, whichever direction that is.
   *
   * `play` is this with the starting point reset first; everything that moves
   * both ways calls this directly.
   */
  const animateTo = useCallback((target: number, config: RevealConfig | SpringConfig) => {
    animating.current = true;

    const animation = isSpring(config)
      ? Animated.spring(value, {
        toValue: target,
        damping: config.damping,
        stiffness: config.stiffness,
        mass: config.mass ?? 1,
        delay: config.delay ?? 0,
        useNativeDriver: true,
      })
      : Animated.timing(value, {
        toValue: target,
        duration: config.duration,
        delay: config.delay ?? 0,
        easing: config.easing ?? Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    animation.start(({ finished }) => {
      animating.current = false;
      if (finished) {
        settled.current = target;
        // Sync the JS copy. This is the half that `settled` alone cannot do.
        value.setValue(target);
      }
    });
  }, [value]);

  const play = useCallback((config: RevealConfig) => {
    value.setValue(from);
    settled.current = from;
    animateTo(to, config);
  }, [value, from, to, animateTo]);

  /** Jump straight to the end, for reduce-motion and for already-seen content. */
  const settle = useCallback(() => {
    animating.current = false;
    settled.current = to;
    value.setValue(to);
  }, [value, to]);

  /** Jump to an arbitrary value without animating, and record it. */
  const set = useCallback((v: number) => {
    animating.current = false;
    settled.current = v;
    value.setValue(v);
  }, [value]);

  return { value, play, animateTo, settle, set };
}
