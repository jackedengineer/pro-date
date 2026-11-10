import { useAuth } from '@clerk/expo';
import { act, render } from '@testing-library/react-native';

import WelcomeRoute from '../../../app/index';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('../../config/public-env', () => ({ isClerkConfigured: true }));
jest.mock('./welcome-screen', () => {
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return { WelcomeScreen: () => <Native.Text>Welcome</Native.Text> };
});
jest.mock('expo-router', () => {
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    router: { push: jest.fn() },
    Redirect: ({ href }: { href: unknown }) => (
      <Native.Text>{`Redirect: ${JSON.stringify(href)}`}</Native.Text>
    ),
  };
});

const mockedUseAuth = jest.mocked(useAuth);
function authState(state: { isLoaded: boolean; isSignedIn?: boolean }) {
  mockedUseAuth.mockReturnValue(state as unknown as ReturnType<typeof useAuth>);
}

describe('start route', () => {
  afterEach(() => jest.useRealTimers());

  it('shows a visible loading state while the session restores, then explains a slow start', async () => {
    jest.useFakeTimers();
    authState({ isLoaded: false });
    const screen = await render(<WelcomeRoute />);

    expect(screen.getByLabelText('Opening Merge')).toBeTruthy();
    expect(screen.queryByText(/Still connecting/)).toBeNull();

    await act(() => jest.advanceTimersByTime(6000));
    expect(screen.getByText(/Still connecting/)).toBeTruthy();
  });

  it('sends a restored session straight to discovery', async () => {
    authState({ isLoaded: true, isSignedIn: true });
    expect((await render(<WelcomeRoute />)).getByText('Redirect: "/discover"')).toBeTruthy();
  });

  it('shows the welcome screen to signed-out visitors', async () => {
    authState({ isLoaded: true, isSignedIn: false });
    expect((await render(<WelcomeRoute />)).getByText('Welcome')).toBeTruthy();
  });
});
