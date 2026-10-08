import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotificationsApi } from '../../api/notifications';
import { NotificationSettingsSheet } from './notification-settings-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const owner = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const clients: QueryClient[] = [];
const settings = { isPaused: false, revision: 0, isAvailable: true, isDeliveryReady: false };
const preference = {
  conversationId: id,
  isEnabled: false,
  revision: 0,
  isAvailable: true,
  isDeliveryReady: false,
};
function setup(chat = true) {
  const api: NotificationsApi = {
    settings: jest.fn().mockResolvedValue(settings),
    saveSettings: jest.fn().mockResolvedValue({ ...settings, isPaused: true, revision: 1 }),
    conversation: jest.fn().mockResolvedValue(preference),
    saveConversation: jest.fn().mockResolvedValue({ ...preference, isEnabled: true, revision: 1 }),
  };
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  clients.push(queries);
  const subject = (
    <QueryClientProvider client={queries}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <NotificationSettingsSheet
          ownerId={owner}
          api={api}
          conversationId={chat ? id : undefined}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
  return { api, queries, subject };
}
afterEach(async () => {
  await cleanup();
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.clear();
});
describe('notification preference controls', () => {
  it('cancels an in-flight setting request on close and ignores late success', async () => {
    const { subject, api, queries } = setup();
    let resolve: (value: typeof preference) => void = () => {};
    jest.mocked(api.saveConversation).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = await render(subject);
    const toggle = await view.findByRole('switch', { name: 'Notify me for this chat' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await fireEvent.press(toggle);
    await waitFor(() => expect(api.saveConversation).toHaveBeenCalledTimes(1));
    const signal = jest.mocked(api.saveConversation).mock.calls[0]?.[2];
    await view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(() => resolve({ ...preference, isEnabled: true, revision: 1 }));
    expect(queries.getQueryData(['conversation-notification', owner, id])).toMatchObject({
      isEnabled: false,
    });
  });
  it('starts silent and explicitly distinguishes a saved preference from push readiness', async () => {
    const { subject, api } = setup();
    const view = await render(subject);
    const toggle = await view.findByRole('switch', { name: 'Notify me for this chat' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }));
    await fireEvent.press(toggle);
    await waitFor(() =>
      expect(api.saveConversation).toHaveBeenCalledWith(id, true, expect.any(AbortSignal)),
    );
    expect(await view.findByText('Preference saved. Push setup is still pending.')).toBeTruthy();
    expect(view.queryByText('Notifications enabled')).toBeNull();
  });
  it('shows setup pending and does not query unmigrated chat settings', async () => {
    const { subject, api } = setup();
    jest.mocked(api.settings).mockResolvedValue({ ...settings, isAvailable: false });
    const view = await render(subject);
    expect(await view.findByText('Push setup pending. Messaging still works.')).toBeTruthy();
    expect(view.getByRole('switch', { name: 'Notify me for this chat' })).toBeDisabled();
    expect(api.conversation).not.toHaveBeenCalled();
  });
  it('does not optimistically claim a failed write was saved', async () => {
    const { subject, api } = setup();
    jest
      .mocked(api.saveConversation)
      .mockRejectedValue(new Error('Couldn’t confirm this setting.'));
    const view = await render(subject);
    const toggle = await view.findByRole('switch', { name: 'Notify me for this chat' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await fireEvent.press(toggle);
    expect(await view.findByText('Couldn’t confirm this setting.')).toBeTruthy();
    expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ checked: false }));
  });
  it('pauses the account without mutating individual chats', async () => {
    const { subject, api } = setup(false);
    const view = await render(subject);
    const toggle = await view.findByRole('switch', { name: 'Pause all chat notifications' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await fireEvent.press(toggle);
    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith(true, expect.any(AbortSignal)),
    );
    expect(api.saveConversation).not.toHaveBeenCalled();
  });
  it('blocks offline writes rather than silently queuing a preference change', async () => {
    const { subject, api } = setup();
    const view = await render(subject);
    const toggle = await view.findByRole('switch', { name: 'Notify me for this chat' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await act(() => onlineManager.setOnline(false));
    await fireEvent.press(toggle);
    expect(await view.findByText('Go online to save notification preferences.')).toBeTruthy();
    expect(api.saveConversation).not.toHaveBeenCalled();
  });
});
