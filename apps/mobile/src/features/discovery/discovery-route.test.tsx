import { useAuth } from '@clerk/expo';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { bootstrapCurrentUser } from '../../api/current-user';
import { useMessaging, type MessagingRuntime } from '../messaging/messaging-provider';
import DiscoverRoute from '../../../app/discover';
import MessagesRoute from '../../../app/messages';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('../../api/current-user', () => ({ bootstrapCurrentUser: jest.fn() }));
jest.mock('../../api/discovery', () => ({ createDiscoveryApi: jest.fn(() => ({})) }));
jest.mock('../../config/public-env', () => ({
  isClerkConfigured: true,
  apiBaseUrl: 'http://test.invalid',
}));
jest.mock('../messaging/messaging-provider', () => ({ useMessaging: jest.fn() }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    router: { push: jest.fn(), setParams: jest.fn() },
    useLocalSearchParams: jest.fn(),
    Redirect: ({ href }: { href: unknown }) => (
      <Native.Text>{`Redirect: ${JSON.stringify(href)}`}</Native.Text>
    ),
  };
});
jest.mock('../messaging/messaging-inbox', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MergedInbox: ({ onOpenConversation }: { onOpenConversation: (id: string) => void }) => (
      <Native.Pressable
        accessibilityRole="button"
        accessibilityLabel="Cached Merged inbox"
        onPress={() => onOpenConversation('match-id')}
      >
        <Native.Text>Cached Merged inbox</Native.Text>
      </Native.Pressable>
    ),
  };
});
jest.mock('./discovery-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DiscoveryScreen: ({
      mergedInbox,
      selectedTab,
      onMerged,
      onTabChange,
    }: React.ComponentProps<typeof import('./discovery-screen').DiscoveryScreen>) => (
      <Native.View>
        <Native.Text>{`Active tab: ${selectedTab}`}</Native.Text>
        {mergedInbox}
        <Native.Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirmed merge"
          onPress={() => onMerged?.('match-id')}
        >
          <Native.Text>Merge</Native.Text>
        </Native.Pressable>
        <Native.Pressable
          accessibilityRole="button"
          accessibilityLabel="Requests tab"
          onPress={() => onTabChange?.('requests')}
        >
          <Native.Text>Requests</Native.Text>
        </Native.Pressable>
      </Native.View>
    ),
  };
});
const auth = { isLoaded: true, isSignedIn: true, getToken: jest.fn() } as unknown as ReturnType<
  typeof useAuth
>;
const hint = jest.fn();
const runtime = { ownerId: 'known-owner', hint } as unknown as MessagingRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(auth);
  jest.mocked(useLocalSearchParams).mockReturnValue({ tab: 'merged' });
  jest.mocked(useMessaging).mockReturnValue({ runtime, error: null, retry: jest.fn() });
  jest
    .mocked(bootstrapCurrentUser)
    .mockResolvedValue({ onboardingStatus: 'COMPLETE' } as Awaited<
      ReturnType<typeof bootstrapCurrentUser>
    >);
});
describe('unified Merged navigation', () => {
  it('opens cached Merged offline when the current session already has a messaging runtime', async () => {
    jest.mocked(bootstrapCurrentUser).mockRejectedValue(new Error('Offline'));
    const view = await render(<DiscoverRoute />);
    await waitFor(() => expect(bootstrapCurrentUser).toHaveBeenCalled());
    expect(await view.findByText('Cached Merged inbox')).toBeTruthy();
    expect(view.getByText('Active tab: merged')).toBeTruthy();
  });
  it('does not bypass onboarding with cached state after an authoritative incomplete profile response', async () => {
    jest
      .mocked(bootstrapCurrentUser)
      .mockResolvedValue({ onboardingStatus: 'IN_PROGRESS' } as Awaited<
        ReturnType<typeof bootstrapCurrentUser>
      >);
    const view = await render(<DiscoverRoute />);
    expect(await view.findByText('Redirect: "/onboarding"')).toBeTruthy();
  });
  it('keeps initialization failures recoverable when there is no cached published session', async () => {
    jest.mocked(useMessaging).mockReturnValue({ runtime: null, error: null, retry: jest.fn() });
    jest.mocked(bootstrapCurrentUser).mockRejectedValueOnce(new Error('Offline'));
    const view = await render(<DiscoverRoute />);
    expect(await view.findByText('Offline')).toBeTruthy();
    expect(view.queryByText('Cached Merged inbox')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Retry discovery' }));
    expect(await view.findByText('Cached Merged inbox')).toBeTruthy();
  });
  it('routes conversations, invalidates confirmed merges, and preserves the selected tab in the URL', async () => {
    const view = await render(<DiscoverRoute />);
    await view.findByText('Cached Merged inbox');
    await fireEvent.press(view.getByRole('button', { name: 'Cached Merged inbox' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'match-id' },
    });
    await fireEvent.press(view.getByRole('button', { name: 'Confirmed merge' }));
    expect(hint).toHaveBeenCalledWith('match-id');
    await fireEvent.press(view.getByRole('button', { name: 'Requests tab' }));
    expect(router.setParams).toHaveBeenCalledWith({ tab: 'requests' });
  });
  it('redirects legacy inbox links to Merged rather than rendering a second inbox', async () => {
    const view = await render(<MessagesRoute />);
    expect(
      view.getByText('Redirect: {"pathname":"/discover","params":{"tab":"merged"}}'),
    ).toBeTruthy();
  });
  it('does not expose cached conversations after sign-out', async () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({ ...auth, isSignedIn: false } as ReturnType<typeof useAuth>);
    const view = await render(<DiscoverRoute />);
    expect(view.getByText('Redirect: "/"')).toBeTruthy();
    expect(view.queryByText('Cached Merged inbox')).toBeNull();
  });
});
