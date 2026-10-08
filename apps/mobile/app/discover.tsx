import { useAuth } from '@clerk/expo';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { bootstrapCurrentUser } from '../src/api/current-user';
import { createDiscoveryApi } from '../src/api/discovery';
import { AppText } from '../src/components/app-text';
import { Screen } from '../src/components/screen';
import { apiBaseUrl, isClerkConfigured } from '../src/config/public-env';
import { DiscoveryScreen } from '../src/features/discovery/discovery-screen';
import { ErrorNotice, QuietButton, sharedStyles } from '../src/features/discovery/discovery-shared';
import { colors } from '../src/theme/tokens';

export default function DiscoverRoute() {
  return isClerkConfigured && apiBaseUrl !== null ? (
    <ConfiguredDiscoveryRoute apiUrl={apiBaseUrl} />
  ) : (
    <Redirect href="/" />
  );
}
function ConfiguredDiscoveryRoute({ apiUrl }: { apiUrl: string }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const actions = useMemo(
    () => createDiscoveryApi({ apiBaseUrl: apiUrl, getToken }),
    [apiUrl, getToken],
  );
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    void bootstrapCurrentUser({ apiBaseUrl: apiUrl, getToken })
      .then((user) => {
        if (active) setStatus(user.onboardingStatus === 'COMPLETE' ? 'ready' : 'onboarding');
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error ? failure.message : 'We could not open discovery. Try again.',
          );
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [apiUrl, getToken, isLoaded, isSignedIn, attempt]);
  if (isLoaded && !isSignedIn) return <Redirect href="/" />;
  if (status === 'onboarding') return <Redirect href="/onboarding" />;
  if (status === 'ready')
    return <DiscoveryScreen actions={actions} onOpenProfile={() => router.push('/onboarding')} />;
  return (
    <Screen>
      <View style={sharedStyles.content}>
        {status === 'error' ? (
          <>
            <ErrorNotice message={error} />
            <QuietButton
              label="Retry discovery"
              onPress={() => {
                setStatus('loading');
                setAttempt((value) => value + 1);
              }}
            />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.plum} />
            <AppText>Opening discovery…</AppText>
          </>
        )}
      </View>
    </Screen>
  );
}
