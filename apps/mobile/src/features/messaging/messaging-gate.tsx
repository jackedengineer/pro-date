import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../components/app-text';
import { Screen } from '../../components/screen';
import { apiBaseUrl, isClerkConfigured } from '../../config/public-env';
import { ErrorNotice, QuietButton, sharedStyles } from '../discovery/discovery-shared';
import { colors } from '../../theme/tokens';
import { useMessaging } from './messaging-provider';

export function MessagingGate({ children }: PropsWithChildren) {
  return !isClerkConfigured || apiBaseUrl === null ? (
    <Redirect href="/" />
  ) : (
    <ConfiguredGate>{children}</ConfiguredGate>
  );
}
function ConfiguredGate({ children }: PropsWithChildren) {
  const auth = useAuth();
  const { runtime, error, retry } = useMessaging();
  if (auth.isLoaded && !auth.isSignedIn) return <Redirect href="/" />;
  if (runtime !== null) return <>{children}</>;
  return (
    <Screen>
      <View style={sharedStyles.content}>
        {error === null ? (
          <>
            <ActivityIndicator color={colors.plum} />
            <AppText>Opening your conversations…</AppText>
          </>
        ) : (
          <>
            <ErrorNotice message={error} />
            <QuietButton label="Retry messaging" onPress={retry} />
          </>
        )}
      </View>
    </Screen>
  );
}
