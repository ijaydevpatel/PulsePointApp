/**
 * An entrance animation that cannot lose the content it is revealing.
 *
 * ── What actually went wrong ────────────────────────────────────────────────
 *
 * Content disappeared on scroll, on a keystroke, on anything, in every tab.
 * It was diagnosed twice as a re-render problem and fixed twice. Both fixes
 * were wrong, and the thing that disproved them is simple: there is not one
 * onScroll handler in this codebase, so scrolling causes no re-render at all.
 * A re-render could not have been the trigger.
 *
 * The real cause is `useNativeDriver: true`. It moves the animated value out
 * of the React tree and into a native animated node, which then writes the
 * opacity straight onto the view. Nothing about that value exists in the props
 * React holds. So the moment Android detaches and re-attaches the view -
 * scrolling it out of the clipping bounds and back, re-laying out when the
 * keyboard opens, recycling it on a tab change - the native node is no longer
 * driving it, and the opacity is whatever it was left with. Usually zero,
 * because that is where the entrance started.
 *
 * Re-pressing the tab brought it back because that remounted the tree and ran
 * the entrance again.
 *
 * ── The two things that fix it ──────────────────────────────────────────────
 *
 * `useNativeDriver: false` for anything that touches opacity. The value then
 * flows through React's normal style props, so a view that is re-created or
 * re-attached is given the correct current opacity by the React tree, the same
 * way it is given its colour. These are short entrances on a handful of
 * blocks, not gesture tracking; the JS driver is entirely adequate and being
 * correct matters more than shaving a frame.
 *
 * `finished`, which is the guarantee rather than the theory. Once the
 * entrance completes, consumers stop passing the animated value and pass a
 * plain `1` instead. After roughly 300ms there is no animation involved in the
 * element being visible at all, so no later native behaviour - including
 * anything about this diagnosis that is still wrong - can hide it. The element
 * type never changes, so this costs no remount and no lost input focus.
 *
 * Native driving is still available, and still correct, for transform-only
 * feedback like a press scale: if that value is ever lost the control is
 * slightly the wrong size, which is not the same class of failure as content
 * that is not there.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface RevealOptions {
  /**
   * Drive on the UI thread. Only for transforms - see the note above on why
   * anything controlling opacity must not.
   */
  native?: boolean;
}

export function useReveal(from = 0, to = 1, options: RevealOptions = {}) {
  const native = options.native ?? false;
  const value = useRef(new Animated.Value(from)).current;
  const settled = useRef(from);
  const animating = useRef(false);

  /**
   * True once the value has come to rest at `to`.
   *
   * Consumers use this to stop involving the animation in visibility at all.
   * It is state rather than a ref because reaching the end has to cause the
   * render that swaps the animated value out for a literal one.
   */
  const [finished, setFinished] = useState(from === to);

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
      // Sync the JS copy. This is the half that `settled` alone cannot do.
      value.setValue(target);
      // And this is the half that makes the result independent of the
      // animation entirely.
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

  /** Jump straight to the end, for reduce-motion and for already-seen content. */
  const settle = useCallback(() => {
    animating.current = false;
    settled.current = to;
    value.setValue(to);
    setFinished(true);
  }, [value, to]);

  /** Jump to an arbitrary value without animating, and record it. */
  const set = useCallback((v: number) => {
    animating.current = false;
    settled.current = v;
    value.setValue(v);
  }, [value]);

  /*
   * Memoised, and this matters more than it looks.
   *
   * Returned as a fresh object literal, this hook put a new reference in
   * callers' hands on every render. A caller that then listed the whole object
   * in an effect's dependency array got that effect re-run every render:
   * play() restarted the animation, which set `finished` false, which caused a
   * render, which re-ran the effect. The tab bar's label and icons flickered
   * continuously because the entrance was starting over several times a
   * second.
   *
   * The memo stops the object churning for the common case. It does not make
   * the object safe to put in a dependency array - `finished` changing still
   * produces a new reference, by design - so depend on the individual
   * functions, which are stable, and read `finished` only while rendering.
   */
  return useMemo(
    () => ({ value, play, animateTo, settle, set, finished }),
    [value, play, animateTo, settle, set, finished],
  );
}
