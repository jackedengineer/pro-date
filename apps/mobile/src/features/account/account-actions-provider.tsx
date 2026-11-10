import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { deleteAccount as requestAccountDeletion } from '../../api/account';
import { SUPPORT_EMAIL } from '../../config/legal';
import { apiBaseUrl, isClerkConfigured } from '../../config/public-env';
import { useNotificationDevice } from '../notifications/notification-provider';
import { AccountActionsContext } from './account-actions';
import { runAccountDeletion } from './delete-account';
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

function confirmAccountDeletion() {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, photos, pull requests, merges and messages for you and the people you talked to. It can’t be undone.',
      [
        { text: 'Keep account', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete account', style: 'destructive', onPress: () => resolve(true) },
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
  const { signOut: endClerkSession, getToken } = useAuth();
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

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const deleteAccount = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    void runAccountDeletion({
      confirm: confirmAccountDeletion,
      requestDeletion: () => {
        setIsDeletingAccount(true);
        if (apiBaseUrl === null) return Promise.reject(new Error('Merge isn’t connected.'));
        return requestAccountDeletion({ apiBaseUrl, getToken });
      },
      endSession: () => endClerkSession(),
    })
      .then((outcome) => {
        if (outcome.status === 'FAILED') {
          Alert.alert('Couldn’t delete your account', outcome.message);
          return;
        }
        if (outcome.status !== 'DELETED') return;
        router.replace('/');
        Alert.alert(
          'Your account is deleted',
          outcome.signInRemoved
            ? 'Your profile, photos and messages are gone.'
            : `Your profile, photos and messages are gone. Your sign-in details couldn’t be removed just now. Email ${SUPPORT_EMAIL} and they’ll be removed for you.`,
        );
      })
      .finally(() => {
        inFlight.current = false;
        setIsDeletingAccount(false);
      });
  }, [endClerkSession, getToken]);

  const value = useMemo(
    () => ({ signOut, isSigningOut, deleteAccount, isDeletingAccount }),
    [signOut, isSigningOut, deleteAccount, isDeletingAccount],
  );
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
