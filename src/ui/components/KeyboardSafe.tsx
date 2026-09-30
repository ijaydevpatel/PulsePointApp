import React, { useEffect, useState } from 'react';
import { View, Keyboard, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';

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
