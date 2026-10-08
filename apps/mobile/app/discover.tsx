import { useAuth } from '@clerk/expo';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
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
import { MergedInbox } from '../src/features/messaging/messaging-inbox';
import { useMessaging } from '../src/features/messaging/messaging-provider';

export default function DiscoverRoute() {
  return isClerkConfigured && apiBaseUrl !== null ? (
    <ConfiguredDiscoveryRoute apiUrl={apiBaseUrl} />
  ) : (
    <Redirect href="/" />
  );
}
function ConfiguredDiscoveryRoute({ apiUrl }: { apiUrl: string }) {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { runtime } = useMessaging();
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
  // A restored, account-scoped runtime may show cached chats while the API is offline.
  // An authoritative onboarding response above still takes precedence; REST rechecks all access.
  if (status === 'ready' || (isLoaded && isSignedIn && runtime !== null))
    return (
      <DiscoveryScreen
        actions={actions}
        onOpenProfile={() => router.push('/onboarding')}
        selectedTab={tab === 'merged' || tab === 'requests' ? tab : 'discover'}
        onTabChange={(value) => router.setParams({ tab: value })}
        onMerged={(id) => runtime?.hint(id)}
        mergedInbox={
          <MergedInbox
            onOpenConversation={(id) => router.push({ pathname: '/messages/[id]', params: { id } })}
          />
        }
      />
    );
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
