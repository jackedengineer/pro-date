import { useAuth } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '../src/components/app-text';
import { Screen } from '../src/components/screen';
import { isClerkConfigured } from '../src/config/public-env';
import { WelcomeScreen } from '../src/features/welcome/welcome-screen';
import { colors, spacing } from '../src/theme/tokens';

/** How long the session restore may take before the start screen explains the wait. */
const SLOW_START_HINT_MS = 6000;

export default function WelcomeRoute() {
  return isClerkConfigured ? <ConfiguredWelcomeRoute /> : <Welcome />;
}

function ConfiguredWelcomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <StartingUp />;
  }

  if (isSignedIn) {
    return <Redirect href="/discover" />;
  }

  return <Welcome />;
}

function Welcome() {
  return <WelcomeScreen onGetStarted={() => router.push('/auth/phone')} />;
}

// The splash screen hides once fonts load, so a blank frame here would look like a hang.
function StartingUp() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_START_HINT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen>
      <View accessibilityLiveRegion="polite" style={styles.content}>
        <ActivityIndicator accessibilityLabel="Opening Merge" color={colors.plum} />
        {slow ? (
          <AppText style={styles.hint}>
            Still connecting. Check your internet connection; Merge will continue on its own.
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  hint: { color: colors.muted, textAlign: 'center' },
});
