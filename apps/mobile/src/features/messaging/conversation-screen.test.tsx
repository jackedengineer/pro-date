import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Conversation } from '@pro-date/contracts';
import type { MessagingApi } from '../../api/messaging';
import { ApiRequestError } from '../../api/http-client';
import type { ChatStorage } from './chat-storage';
import { ChatThread } from './chat-thread';
import { ConversationScreen } from './conversation-screen';
import { useMessaging, type MessagingRuntime } from './messaging-provider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FlashListProps } from '@shopify/flash-list';
import type { FlatList } from 'react-native';
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
function setup() {
  const storage: ChatStorage = {
    read: jest.fn().mockResolvedValue({ conversation, messages: [], outgoing: [] }),
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
    unmatch: jest.fn(),
  };
  const thread = new ChatThread(id, owner, storage, api, () => owner, jest.fn());
  const runtime = {
    ownerId: owner,
    thread: () => thread,
    watch: () => () => {},
    api,
    safety: { block: jest.fn(), report: jest.fn() },
  } as unknown as MessagingRuntime;
  jest.mocked(useMessaging).mockReturnValue({ runtime, error: null, retry: jest.fn() });
  return { thread, api, storage };
}
describe('conversation UI', () => {
  it('shows the real match, multiline composer, safe message states and accessible safety controls', async () => {
    const { thread } = setup();
    await thread.ready;
    const view = await render(<Subject />);
    expect(view.getByText('Avery')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Report or block' })).toBeTruthy();
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
});
