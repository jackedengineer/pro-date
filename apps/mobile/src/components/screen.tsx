import type { PropsWithChildren } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';

interface ScreenProps extends PropsWithChildren {
  style?: ViewStyle;
  /** Which safe-area edges to pad. Leave one out when a bar of its own colour fills it. */
  edges?: readonly Edge[];
}

export function Screen({ children, style, edges }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.screen, style]} {...(edges === undefined ? {} : { edges })}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
