/**
 * Floating navigation bar.
 *
 * A dark capsule carrying five icons. The selected one expands into a light
 * pill and reveals its label; the rest stay as glyphs. Only one label is ever
 * on screen, which is what lets the bar stay this short - five permanent
 * labels would need either tiny type or a taller bar.
 *
 * ── Colour ───────────────────────────────────────────────────────────────────
 *
 * Ink and white, taken from the welcome screen rather than from the product
 * theme's blue. The bar is the brand hull colour (#1A1A1A, the hexagon in the
 * mark), the selected pill is the same white as the auth surfaces, and the
 * selected glyph and label are the same near-black as the headlines. It is
 * deliberately monochrome: this sits above every screen in the app, including
 * the triage result where colour carries clinical meaning, and a coloured
 * chrome element competing with a red EMERGENCY band is a real hazard rather
 * than a style preference.
 *
 * This is why the bar does not read the theme palette. It is fixed light-on-
 * dark in both schemes, like a system navigation bar.
 *
 * ── Why the selection is laid out with flex, not measured ────────────────────
 *
 * The previous version measured every tab and drove an indicator from the
 * measurements. That was right for an indicator that had to *track* tabs of
 * unknown width. Here the selected tab changes width itself, so measurement
 * would mean laying out, reading back, then animating to a number that the
 * next layout invalidates.
 *
 * Flex weights state the relationship directly instead: unselected tabs take
 * one unit, the selected one takes SELECTED_UNITS, and the row divides itself.
 * No measurement, no arithmetic, and it cannot drift - the expanded pill is
 * exactly as wide as the layout says it is.
 *
 * The touch-target floor falls out of the same arithmetic rather than being
 * hoped for; see MIN_BAR_WIDTH below.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
  LayoutAnimation, Platform, UIManager, AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BAR_PAD, BAR_SIDE_MARGIN, MIN_BAR_WIDTH, SELECTED_UNITS, TABS, TabKey,
} from './routes';
import { useReveal } from '../useReveal';
import { TYPE, S, R, TOUCH } from '../theme';
import { Icon } from '../components/Icon';

// Only needed on the old architecture; under Fabric layout animations are on
// by default and the setter does not exist. Guarded rather than assumed.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─────────────────────────────── palette ────────────────────────────────── */

/** The hexagon in the brand mark. */
const BAR = '#1A1A1A';
/** Selected pill. Same white as the auth surfaces. */
const PILL = '#FFFFFF';
/** Selected glyph and label on that pill. 18.4:1. */
const ON_PILL = '#0A0A0A';
/**
 * Unselected glyphs. 7.2:1 against the bar - comfortably past the 3:1 that
 * WCAG 1.4.11 asks of a control you have to be able to find.
 */
const OFF_PILL = '#A6A6A6';

/* ─────────────────────────────── geometry ───────────────────────────────── */

/*
 * SELECTED_UNITS, BAR_PAD, BAR_SIDE_MARGIN and MIN_BAR_WIDTH now live in
 * routes.ts alongside TABS. The touch-target floor is a consequence of how
 * many destinations there are, so it belongs with the destinations - and the
 * test suite can then check the arithmetic without importing a component.
 */
const PAD = BAR_PAD;
const SIDE_MARGIN = BAR_SIDE_MARGIN;

export function TabBar({ active, onSelect }: { active: TabKey; onSelect: (k: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /*
   * Reduce-motion is read once and cached. The expand is a width change, which
   * is the kind of motion the setting exists for; when it is on the pill snaps
   * instead, and nothing else about the bar changes.
   */
  const reduceMotion = useRef(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (alive) reduceMotion.current = r; });
    return () => { alive = false; };
  }, []);

  /**
   * Fades the label in as the pill opens.
   *
   * It used to reset to 0 and start after a 90ms delay, on the reasoning that
   * the label should not appear in a pill that had not finished opening. The
   * effect on a real device was a visible blink: for those 90ms the selected
   * tab was an expanded white pill with nothing in it, so switching tabs
   * looked like the name had been lost. It now starts partly visible and has
   * no delay - the label is legible for the whole transition, and the pill
   * clipping it while it opens reads as the label arriving rather than as a
   * gap.
   */
  /*
   * Through useReveal. Left as a bare Animated.Value this was the persistent
   * form of the label glitch: the fade ends at 1 natively but stays 0.35 in
   * JavaScript, so the next re-render left the selected tab's name at 35%
   * opacity for good.
   */
  const label = useReveal(0.35, 1);
  // Literal 1 once the fade is over, so a re-attached label cannot come back
  // at 35% - the same guarantee Enter gets.
  const labelIn: Animated.Value | number = label.finished ? 1 : label.value;

  useEffect(() => {
    if (reduceMotion.current) { label.settle(); return; }

    LayoutAnimation.configureNext({
      duration: 260,
      update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleXY },
    });

    label.play({ duration: 140, easing: Easing.out(Easing.quad) });
  }, [active, label]);

  /*
   * Below the floor the bar would have to shrink its targets. It drops the
   * side margins first - losing the floating inset is a far smaller loss than
   * losing a tappable control.
   */
  const margin = width < MIN_BAR_WIDTH ? S.xs : SIDE_MARGIN;

  return (
    <View
      style={[
        st.wrap,
        { bottom: Math.max(insets.bottom, S.sm) + S.xs, left: margin, right: margin },
      ]}
      pointerEvents="box-none"
    >
      <View style={st.bar} accessibilityRole="tablist">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Pressable
              key={t.key}
              onPress={() => onSelect(t.key)}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on }}
              android_ripple={null}
              style={({ pressed }) => [
                st.tab,
                { flex: on ? SELECTED_UNITS : 1 },
                on && st.tabOn,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Icon
                name={t.icon}
                size={21}
                color={on ? ON_PILL : OFF_PILL}
                weight={on ? 'bold' : 'regular'}
              />

              {on ? (
                <Animated.Text
                  numberOfLines={1}
                  style={[st.label, { opacity: labelIn }]}
                  // The Pressable already carries the label for screen
                  // readers; announcing it twice is noise.
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {t.label}
                </Animated.Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute' },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR,
    borderRadius: R.pill,
    padding: PAD,
    /*
     * Android draws elevation as a real shadow, and at high values on a
     * rounded shape it collapses into a hard dark ring that reads as an
     * outline rather than as depth. Wide, soft and low-opacity instead.
     */
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH,
    borderRadius: R.pill,
    paddingHorizontal: 4,
  },
  tabOn: {
    backgroundColor: PILL,
    paddingHorizontal: 12,
  },

  label: {
    ...TYPE.label,
    color: ON_PILL,
    fontSize: 13.5,
    marginLeft: 7,
    // Keeps a long label from pushing the glyph out of the pill; it ellipsises
    // instead, which only ever happens on a viewport below the floor.
    flexShrink: 1,
  },
});
