import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Conversation } from '@pro-date/contracts';
import type { MessagingApi } from '../../api/messaging';
import { ApiRequestError } from '../../api/http-client';
import type { ChatStorage } from './chat-storage';
import { ChatThread } from './chat-thread';
import { ConversationScreen } from './conversation-screen';
import { router } from 'expo-router';
import { useMessaging, type MessagingRuntime } from './messaging-provider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FlashListProps } from '@shopify/flash-list';
import type { FlatList } from 'react-native';
import { Alert } from 'react-native';
import type { ChatRow } from './chat-thread';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('./messaging-provider', () => ({ useMessaging: jest.fn() }));
jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual<typeof import('react-native-keyboard-controller')>(
    'react-native-keyboard-controller/jest',
  ),
);
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: number) => React.useRef({ value: initial, set: jest.fn() }).current,
  };
});
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: React.forwardRef<FlatList<ChatRow>, FlashListProps<ChatRow>>(
      function TestList(props, ref) {
        const Scroll = props.renderScrollComponent;
        return (
          <Native.FlatList
            data={props.data}
            keyExtractor={props.keyExtractor ?? ((_row, index) => String(index))}
            renderItem={({ item, index }) =>
              props.renderItem?.({ item, index, target: 'Cell' }) ?? null
            }
            ListHeaderComponent={props.ListHeaderComponent ?? null}
            ListEmptyComponent={props.ListEmptyComponent ?? null}
            ref={ref}
            renderScrollComponent={(scrollProps) =>
              Scroll === undefined ? (
                <Native.ScrollView {...scrollProps} />
              ) : (
                React.createElement(Scroll, scrollProps)
              )
            }
          />
        );
      },
    ),
  };
});
const owner = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const conversation: Conversation = {
  id,
  member: { userId: '10000000-0000-4000-8000-000000000003', displayName: 'Avery', photoUrl: null },
  createdAt: '2026-10-08T00:00:00.000Z',
  activityAt: '2026-10-08T00:00:00.000Z',
  lastMessage: null,
};
function Subject() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <ConversationScreen id={id} />
    </SafeAreaProvider>
  );
}
function setup(cachedConversation: Conversation | null = conversation) {
  const storage: ChatStorage = {
    read: jest
      .fn()
      .mockResolvedValue({ conversation: cachedConversation, messages: [], outgoing: [] }),
    saveConversations: jest.fn(),
    cachedConversations: jest.fn().mockResolvedValue([]),
    saveConversation: jest.fn(),
    saveMessages: jest.fn(),
    enqueue: jest.fn(),
    setFailure: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    pendingIds: jest.fn(),
    close: jest.fn(),
  };
  const unmatch = jest.fn();
  const api: MessagingApi = {
    conversation: jest.fn().mockResolvedValue(conversation),
    conversations: jest.fn(),
    history: jest.fn().mockResolvedValue({
      data: [],
      olderCursor: null,
      latestSequence: 0,
      nextAfterSequence: null,
    }),
    send: jest.fn(),
    unmatch,
  };
  const thread = new ChatThread(id, owner, storage, api, () => owner, jest.fn());
  const block = jest.fn();
  const runtime = {
    ownerId: owner,
    thread: () => thread,
    watch: () => () => {},
    api,
    safety: { block, report: jest.fn() },
  } as unknown as MessagingRuntime;
  jest.mocked(useMessaging).mockReturnValue({ runtime, error: null, retry: jest.fn() });
  return { thread, api, storage, runtime, unmatch, block };
}
beforeEach(() => jest.clearAllMocks());
describe('conversation UI', () => {
  it('does not call an uncached existing history a brand-new conversation', async () => {
    const { thread } = setup({
      ...conversation,
      lastMessage: {
        id: owner,
        clientId: owner,
        conversationId: id,
        senderId: owner,
        body: 'An already saved hello.',
        sequence: 1,
        createdAt: conversation.createdAt,
      },
    });
    await thread.ready;
    const view = await render(<Subject />);
    expect(view.queryByText('You both approved the merge.')).toBeNull();
    expect(view.getByText('Your conversation is not loaded yet.')).toBeTruthy();
    thread.dispose();
  });
  it('does not invite a first message when a conversation has not loaded', async () => {
    const { thread } = setup(null);
    await thread.ready;
    const view = await render(<Subject />);
    expect(view.queryByText('You both approved the merge.')).toBeNull();
    expect(view.getByText('Your conversation is not loaded yet.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Send message' })).toBeDisabled();
    thread.dispose();
  });
  it('returns to Merged after confirmed unmatch and clears the device conversation', async () => {
    const { thread, unmatch, storage } = setup();
    await thread.ready;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const view = await render(<Subject />);
      await fireEvent.press(view.getByRole('button', { name: 'Unmatch' }));
      await act(() => {
        alert.mock.calls[0]?.[2]?.find((button) => button.text === 'Unmatch')?.onPress?.();
      });
      await waitFor(() => expect(unmatch).toHaveBeenCalledWith(id));
      expect(storage.clear).toHaveBeenCalledWith(id);
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/discover',
        params: { tab: 'merged' },
      });
    } finally {
      alert.mockRestore();
      thread.dispose();
    }
  });
  it('returns to Merged after blocking rather than leaving a cached chat open', async () => {
    const { thread, block, storage } = setup();
    await thread.ready;
    const view = await render(<Subject />);
    await fireEvent.press(view.getByRole('button', { name: 'Report or block' }));
    await fireEvent.press(view.getByRole('button', { name: 'Block this member' }));
    await waitFor(() => expect(block).toHaveBeenCalledWith(conversation.member.userId));
    expect(storage.clear).toHaveBeenCalledWith(id);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/discover',
      params: { tab: 'merged' },
    });
    thread.dispose();
  });
  it('shows the real match, multiline composer, safe message states and accessible safety controls', async () => {
    const { thread } = setup();
    await thread.ready;
    const view = await render(<Subject />);
    expect(view.getByText('Avery')).toBeTruthy();
    expect(view.getByText('You both approved the merge.')).toBeTruthy();
    expect(
      view.getByText(
        'Ship the first hello. A question about their profile is a good place to start.',
      ),
    ).toBeTruthy();
    expect(view.getByRole('button', { name: 'Report or block' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Chat notifications' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Unmatch' })).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Message'), 'A thoughtful hello.');
    await fireEvent.press(view.getByRole('button', { name: 'Send message' }));
    expect(await view.findByText('A thoughtful hello.')).toBeTruthy();
    expect(await view.findByText(/· Queued$/)).toBeTruthy();
    expect(view.getByLabelText('Message').props.value).toBe('');
    thread.dispose();
  });
  it('removes private cached content and disables the composer after access is revoked', async () => {
    const { thread, api, storage } = setup();
    await thread.ready;
    const view = await render(<Subject />);
    jest
      .mocked(api.conversation)
      .mockRejectedValue(new ApiRequestError('Unavailable', 404, 'NOT_FOUND', false));
    await act(async () => {
      thread.setEnabled(true);
      await thread.sync();
    });
    await waitFor(() => expect(view.getByText('This connection has ended.')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(storage.clear).toHaveBeenCalledWith(id);
    thread.dispose();
  });
  it('returns directly to the Merged inbox, not a separate Messages screen', async () => {
    const { thread } = setup();
    await thread.ready;
    const view = await render(<Subject />);
    await fireEvent.press(view.getByRole('button', { name: 'Back to Merged' }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/discover',
      params: { tab: 'merged' },
    });
    thread.dispose();
  });
});
