import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resolveBootstrapState } from '../src/bootstrap/resolve-bootstrap-state';
import { colors, spacing } from '../src/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const bootstrapState = resolveBootstrapState({ fontError, fontsLoaded });

  useEffect(() => {
    if (bootstrapState !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [bootstrapState]);

  if (bootstrapState === 'loading') {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {bootstrapState === 'error' ? (
          <View accessibilityRole="alert" style={styles.errorContainer}>
            <Text style={styles.errorTitle}>We couldn’t open pro·dat.</Text>
            <Text style={styles.errorBody}>Close the app and try again.</Text>
          </View>
        ) : (
          <Stack
            screenOptions={{
              animation: 'fade',
              contentStyle: styles.root,
              headerShown: false,
            }}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
