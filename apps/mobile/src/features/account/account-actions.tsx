import LogOut from 'lucide-react-native/icons/log-out';
import { createContext, useContext } from 'react';

import { AppButton } from '../../components/app-button';
import { IconButton } from '../../components/icon-button';

// Leaf UI depends only on this context. The Clerk-aware provider lives in
// account-actions-provider.tsx, matching the rule that only routes/providers import Clerk.
export interface AccountActions {
  signOut: () => void;
  isSigningOut: boolean;
  /** Asks for confirmation, then permanently deletes the account and everything in it. */
  deleteAccount: () => void;
  isDeletingAccount: boolean;
}
export const AccountActionsContext = createContext<AccountActions | null>(null);
export const useAccountActions = () => useContext(AccountActionsContext);

/** Full-width variant for screens without a header, such as a failed account bootstrap. */
export function SignOutButton() {
  const actions = useAccountActions();
  if (actions === null) return null;
  return (
    <AppButton
      label="Sign out"
      variant="quiet"
      loading={actions.isSigningOut}
      disabled={actions.isDeletingAccount}
      onPress={actions.signOut}
    />
  );
}

/** The stores require this to be reachable inside the app, not only on a website. */
export function DeleteAccountButton() {
  const actions = useAccountActions();
  if (actions === null) return null;
  return (
    <AppButton
      label={actions.isDeletingAccount ? 'Deleting…' : 'Delete account'}
      accessibilityLabel={actions.isDeletingAccount ? 'Deleting account' : 'Delete account'}
      variant="quietDanger"
      loading={actions.isDeletingAccount}
      disabled={actions.isSigningOut}
      onPress={actions.deleteAccount}
    />
  );
}

/** Renders nothing outside AccountActionsProvider (unconfigured Clerk or isolated tests). */
export function SignOutIconButton() {
  const actions = useAccountActions();
  if (actions === null) return null;
  return (
    <IconButton
      label="Sign out"
      icon={LogOut}
      disabled={actions.isSigningOut}
      onPress={actions.signOut}
    />
  );
}
