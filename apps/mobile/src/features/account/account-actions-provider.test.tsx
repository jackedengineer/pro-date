import { useAuth } from '@clerk/expo';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { useNotificationDevice } from '../notifications/notification-provider';
import { SignOutButton, SignOutIconButton } from './account-actions';
import { AccountActionsProvider } from './account-actions-provider';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../config/public-env', () => ({ isClerkConfigured: true }));
jest.mock('../notifications/notification-provider', () => ({ useNotificationDevice: jest.fn() }));

const order: string[] = [];
const signOut = jest.fn(() => {
  order.push('signOut');
  return Promise.resolve();
});
const beforeSignOut = jest.fn(() => {
  order.push('revoke');
  return Promise.resolve(true);
});

let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

/** Presses the alert button with this label, as a member would. */
function answerAlert(label: string) {
  const buttons: AlertButton[] | undefined = alertSpy.mock.calls.at(-1)?.[2];
  const button = buttons?.find((candidate) => candidate.text === label);
  if (button?.onPress === undefined) throw new Error(`No "${label}" button`);
  button.onPress();
}

beforeEach(() => {
  order.length = 0;
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(useAuth).mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useNotificationDevice).mockReturnValue({
    status: 'READY',
    enable: jest.fn(),
    beforeSignOut,
    canRevoke: true,
  });
});

describe('account actions', () => {
  it('revokes push for this phone, ends the session, then leaves the signed-in area', async () => {
    await render(
      <AccountActionsProvider>
        <SignOutIconButton />
      </AccountActionsProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out of Merge?',
      expect.stringContaining('waiting to send will be removed'),
      expect.any(Array),
      expect.any(Object),
    );
    answerAlert('Sign out');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(order).toEqual(['revoke', 'signOut']);
  });

  it('asks before signing out when alerts could not be confirmed off', async () => {
    beforeSignOut.mockResolvedValueOnce(false);
    await render(
      <AccountActionsProvider>
        <SignOutButton />
      </AccountActionsProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    answerAlert('Sign out');
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith(
        'Chat alerts may continue',
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      ),
    );
    expect(signOut).not.toHaveBeenCalled();

    answerAlert('Sign out anyway');
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('renders no control outside the provider', async () => {
    await render(<SignOutIconButton />);
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });
});
