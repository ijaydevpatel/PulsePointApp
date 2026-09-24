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
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, LayoutChangeEvent,
  LayoutAnimation, Platform, UIManager, AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BAR_PAD, BAR_SIDE_MARGIN, MIN_BAR_WIDTH, SELECTED_UNITS, TABS, TabKey, pillSlot,
  PILL_ICON, PILL_GAP, PILL_PAD_H, PILL_FONT,
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
   * The label appears and disappears with the pill, and nothing animates it
   * directly.
   *
   * It has been through three versions. First it faded from 0 after a 90ms
   * delay, which left the expanded pill visibly empty for those 90ms. Then it
   * faded from 0.35 with no delay, which removed the gap but still dipped the
   * text on every switch. Then that fade was moved onto an animated value
   * whose hook object was listed as an effect dependency - so the effect ran
   * on every render, restarted the fade every time, and the label and icons
   * flickered continuously.
   *
   * There is no animated value here now. The label is mounted when its tab is
   * selected and unmounted when it is not, and LayoutAnimation's create and
   * delete phases fade it in and out as part of the same transition that opens
   * the pill. One mechanism instead of two, and nothing to restart.
   */
  useEffect(() => {
    if (reduceMotion.current) return;

    LayoutAnimation.configureNext({
      duration: 260,
      /*
       * No scaleXY on the update phase. It applies a scale transform to views
       * whose bounds are changing, so the pill's icon and text were being
       * squashed and redrawn through the whole 260ms - legible as a shimmer
       * even when nothing else was wrong. Animating the frame alone moves the
       * pill open without touching what is inside it.
       */
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [active]);

  /*
   * Below the floor the bar would have to shrink its targets. It drops the
   * side margins first - losing the floating inset is a far smaller loss than
   * losing a tappable control.
   */
  /*
   * ── The selected pill slides ───────────────────────────────────────────
   *
   * It used to be a background colour on whichever tab was selected, so
   * moving between tabs made it disappear from one place and reappear in
   * another. The eye reads that as two pills, not one moving, and loses the
   * thing it was tracking.
   *
   * One pill now, drawn behind the row and animated between slots.
   *
   * Its position needs no measurement of the tabs themselves, which matters
   * because measuring them is what this component was built to avoid. The row
   * is divided by flex weights, so the arithmetic is already decided: the
   * unselected tabs take one unit each, the selected one takes
   * SELECTED_UNITS, and UNITS is their total. Given the bar's inner width the
   * slot boundaries follow exactly, and one onLayout supplies that.
   *
   * left and width are animated on the JS driver because neither is a
   * transform - the native driver cannot touch them. That is fine at this
   * size: it is one view moving for 260ms.
   */
  const [barWidth, setBarWidth] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const index = Math.max(0, TABS.findIndex((t) => t.key === active));
  const { left: pillLeft, width: pillWidth } = pillSlot(barWidth, index);

  const { value: leftV, animateTo: slideTo, set: setLeft } = useReveal(0, 0);
  const { value: widthV, animateTo: growTo, set: setWidth } = useReveal(0, 0);

  /** False until the first real layout, so the pill appears in place. */
  const placed = useRef(false);

  useEffect(() => {
    if (pillWidth <= 0) return;

    // First paint, or reduce-motion: be where you belong, without travelling.
    if (!placed.current || reduceMotion.current) {
      placed.current = true;
      setLeft(pillLeft);
      setWidth(pillWidth);
      return;
    }

    const config = { duration: 260, easing: Easing.out(Easing.cubic) };
    slideTo(pillLeft, config);
    growTo(pillWidth, config);
  }, [pillLeft, pillWidth, slideTo, growTo, setLeft, setWidth]);

  const margin = width < MIN_BAR_WIDTH ? S.xs : SIDE_MARGIN;

  return (
    <View
      style={[
        st.wrap,
        { bottom: Math.max(insets.bottom, S.sm) + S.xs, left: margin, right: margin },
      ]}
      pointerEvents="box-none"
    >
      <View style={st.bar} accessibilityRole="tablist" onLayout={onBarLayout}>
        {/*
          Behind the row, and not a sibling of any one tab - that is what lets
          it survive the selection moving.
        */}
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[st.pill, { left: leftV, width: widthV }]}
          />
        ) : null}

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
                on && st.tabOnPadding,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Icon
                name={t.icon}
                size={PILL_ICON}
                color={on ? ON_PILL : OFF_PILL}
                weight={on ? 'bold' : 'regular'}
              />

              {on ? (
                <Text
                  numberOfLines={1}
                  style={st.label}
                  // The Pressable already carries the label for screen
                  // readers; announcing it twice is noise.
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {t.label}
                </Text>
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
  /*
   * Padding only. The white is the sliding pill's job now; leaving it here as
   * well would put a second, stationary pill under the moving one.
   */
  tabOnPadding: {
    paddingHorizontal: PILL_PAD_H,
  },

  pill: {
    position: 'absolute',
    top: PAD,
    height: TOUCH,
    borderRadius: R.pill,
    backgroundColor: PILL,
  },

  label: {
    ...TYPE.label,
    color: ON_PILL,
    fontSize: PILL_FONT,
    marginLeft: PILL_GAP,
    /*
     * The last line of defence, not the plan.
     *
     * SELECTED_UNITS is sized so every label in TABS fits at the narrowest
     * viewport the bar supports, and a test holds it to that. This keeps a
     * label that somehow still overruns from pushing the glyph out of the
     * pill - it ellipsises instead, which is the lesser failure.
     */
    flexShrink: 1,
  },
});
