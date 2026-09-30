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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BAR = '#1A1A1A';

const PILL = '#FFFFFF';

const ON_PILL = '#0A0A0A';

const OFF_PILL = '#A6A6A6';

const PAD = BAR_PAD;
const SIDE_MARGIN = BAR_SIDE_MARGIN;

export function TabBar({ active, onSelect }: { active: TabKey; onSelect: (k: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const reduceMotion = useRef(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (alive) reduceMotion.current = r; });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion.current) return;

    LayoutAnimation.configureNext({
      duration: 260,

      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [active]);

  const [barWidth, setBarWidth] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const index = Math.max(0, TABS.findIndex((t) => t.key === active));
  const { left: pillLeft, width: pillWidth } = pillSlot(barWidth, index);

  const { value: leftV, animateTo: slideTo, set: setLeft } = useReveal(0, 0);
  const { value: widthV, animateTo: growTo, set: setWidth } = useReveal(0, 0);

  const placed = useRef(false);

  useEffect(() => {
    if (pillWidth <= 0) return;

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

    flexShrink: 1,
  },
});
