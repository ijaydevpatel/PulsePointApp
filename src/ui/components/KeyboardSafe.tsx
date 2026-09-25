/**
 * Keeps the keyboard from covering whatever the person is typing into.
 *
 * ── Why this is needed at all ────────────────────────────────────────────────
 *
 * Android used to do this for us. `adjustResize` shrank the window when the
 * keyboard opened, so a ScrollView got shorter, and the focused field was
 * scrolled into what was left. That is why every screen here was written with
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` - iOS needed
 * help and Android did not.
 *
 * Android 15 and edge-to-edge changed that. The app now draws behind the
 * system bars and the window no longer resizes when the keyboard appears; the
 * keyboard is simply an inset laid over the top of the app. So the old code
 * did nothing on Android, and any field in the lower half of the screen was
 * typed into blind.
 *
 * ── Why this and not KeyboardAvoidingView ────────────────────────────────────
 *
 * KeyboardAvoidingView's Android path has never been the well-trodden one -
 * it was rarely needed - and under edge-to-edge its measurements are taken
 * against a window that is not changing size. Reading the keyboard height
 * from the event that announces it is both simpler and the thing that is
 * actually true.
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *
 * Reserves the keyboard's height at the bottom of its own box, which shrinks
 * whatever is inside it - a ScrollView, most usefully - to the space that is
 * still visible. That restores exactly the behaviour `adjustResize` used to
 * provide, including the platform's own habit of scrolling the focused input
 * back into view once its scroll container gets smaller.
 */
import React, { useEffect, useState } from 'react';
import { View, Keyboard, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';

/**
 * Height of the on-screen keyboard, or 0 when it is closed.
 *
 * iOS gets the `Will` events so the layout moves with the keyboard's own
 * animation rather than snapping after it. Android only reliably fires the
 * `Did` pair, and its keyboard appears fast enough that the difference is not
 * worth the events that never arrive.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';

    const shown = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setHeight(e.endCoordinates?.height ?? 0),
    );
    const hidden = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setHeight(0),
    );

    return () => { shown.remove(); hidden.remove(); };
  }, []);

  return height;
}

export function KeyboardSafe({ children, style, extra = 0 }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Height already accounted for by something else at the bottom of the
   * screen - the floating tab bar, typically. Subtracted so the space is not
   * reserved twice, which would leave a band of empty screen above the
   * keyboard.
   */
  extra?: number;
}) {
  const keyboard = useKeyboardHeight();
  const inset = Math.max(0, keyboard - extra);

  return (
    <View style={[st.fill, { paddingBottom: inset }, style]}>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
});
