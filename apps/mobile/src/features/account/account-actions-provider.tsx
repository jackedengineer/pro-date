import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { isClerkConfigured } from '../../config/public-env';
import { useNotificationDevice } from '../notifications/notification-provider';
import { AccountActionsContext } from './account-actions';
import { runSignOut, type UnconfirmedRevocationChoice } from './sign-out';

function confirmSignOut() {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Sign out of Merge?',
      'Your profile, matches and sent messages stay saved. Messages still waiting to send will be removed from this phone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function askAboutUnconfirmedAlerts() {
  return new Promise<UnconfirmedRevocationChoice>((resolve) => {
    Alert.alert(
      'Chat alerts may continue',
      'Couldn’t confirm this phone will stop getting Merge chat alerts. Check your connection and try again, or sign out anyway and turn off Merge notifications in your phone’s settings.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Try again', onPress: () => resolve('retry') },
        { text: 'Sign out anyway', style: 'destructive', onPress: () => resolve('proceed') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    );
  });
}

function ConfiguredAccountActionsProvider({ children }: PropsWithChildren) {
  const { signOut: endClerkSession } = useAuth();
  const { beforeSignOut, canRevoke } = useNotificationDevice();
  const inFlight = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSigningOut(true);
    void runSignOut({
      confirm: confirmSignOut,
      canRevokeDevice: canRevoke,
      revokeDevice: beforeSignOut,
      onUnconfirmedRevocation: askAboutUnconfirmedAlerts,
      // Ending the Clerk session makes MessagingProvider purge this owner's cache and queue.
      endSession: () => endClerkSession(),
    })
      .then((outcome) => {
        if (outcome === 'SIGNED_OUT') router.replace('/');
        else if (outcome === 'FAILED')
          Alert.alert('Couldn’t sign you out', 'Check your connection and try again.');
      })
      .finally(() => {
        inFlight.current = false;
        setIsSigningOut(false);
      });
  }, [beforeSignOut, canRevoke, endClerkSession]);

  const value = useMemo(() => ({ signOut, isSigningOut }), [signOut, isSigningOut]);
  return <AccountActionsContext.Provider value={value}>{children}</AccountActionsContext.Provider>;
}

/** Mount inside NotificationProvider: sign-out must revoke this phone's push binding first. */
export function AccountActionsProvider({ children }: PropsWithChildren) {
  return isClerkConfigured ? (
    <ConfiguredAccountActionsProvider>{children}</ConfiguredAccountActionsProvider>
  ) : (
    <>{children}</>
  );
}
