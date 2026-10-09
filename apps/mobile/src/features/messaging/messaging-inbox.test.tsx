import { act, fireEvent, render } from '@testing-library/react-native';
import type { Conversation } from '@pro-date/contracts';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FlashListProps } from '@shopify/flash-list';
import { Text } from 'react-native';
import { MergedInbox } from './messaging-inbox';
import { useMessaging, type MessagingRuntime } from './messaging-provider';
import type { MergedInboxRow } from './merged-inbox-model';
import type { MessagingApi } from '../../api/messaging';

jest.mock('./messaging-provider', () => ({ useMessaging: jest.fn() }));
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: (props: FlashListProps<MergedInboxRow>) => (
      <Native.View>
        {props.ListHeaderComponent as React.ReactNode}
        {(props.data ?? []).map((item, index) => (
          <Native.View key={props.keyExtractor?.(item, index)}>
            {props.renderItem?.({ item, index, target: 'Cell' })}
          </Native.View>
        ))}
        {props.data?.length === 0 ? (props.ListEmptyComponent as React.ReactNode) : null}
        {props.ListFooterComponent as React.ReactNode}
      </Native.View>
    ),
  };
});

const owner = '10000000-0000-4000-8000-000000000001';
const untouched: Conversation = {
  id: '10000000-0000-4000-8000-000000000002',
  member: { userId: '10000000-0000-4000-8000-000000000003', displayName: 'Avery', photoUrl: null },
  createdAt: '2026-10-08T00:00:00.000Z',
  activityAt: '2026-10-08T00:00:00.000Z',
  lastMessage: null,
};
const sent: Conversation = {
  ...untouched,
  id: '10000000-0000-4000-8000-000000000004',
  member: { ...untouched.member, displayName: 'Jamie', photoUrl: 'https://example.com/photo.jpg' },
  lastMessage: {
    id: owner,
    clientId: owner,
    conversationId: '10000000-0000-4000-8000-000000000004',
    senderId: owner,
    sequence: 1,
    body: 'What are you making this weekend?',
    createdAt: '2026-10-08T01:00:00.000Z',
  },
  activityAt: '2026-10-08T01:00:00.000Z',
};
const clients: QueryClient[] = [];
function setup(data: Conversation[] = [untouched, sent]) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(queries);
  const conversations = jest
    .fn<ReturnType<MessagingApi['conversations']>, Parameters<MessagingApi['conversations']>>()
    .mockResolvedValue({ data, nextCursor: null });
  const saveConversations = jest.fn().mockResolvedValue(undefined);
  const runtime = {
    ownerId: owner,
    api: { conversations },
    storage: { saveConversations },
    queries,
  } as unknown as MessagingRuntime;
  jest.mocked(useMessaging).mockReturnValue({ runtime, error: null, retry: jest.fn() });
  const open = jest.fn();
  const subject = (
    <QueryClientProvider client={queries}>
      <MergedInbox onOpenConversation={open} />
    </QueryClientProvider>
  );
  return { queries, conversations, saveConversations, open, subject };
}
afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.clear();
});

describe('Merged inbox UI', () => {
  it('includes untouched matches, separates turns, and opens the chat directly', async () => {
    const { subject, open, saveConversations } = setup();
    const view = await render(subject);
    expect(await view.findByText('Your turn')).toBeTruthy();
    expect(view.getByText('Their turn')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(view.getByText('Start the conversation')).toBeTruthy();
    expect(view.getByText('You: What are you making this weekend?')).toBeTruthy();
    expect(view.queryByText('Messages')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: /Chat with Avery.*Your turn/ }));
    expect(open).toHaveBeenCalledWith(untouched.id);
    expect(saveConversations).toHaveBeenCalledWith([untouched, sent]);
    expect(view.getByTestId(`merged-avatar-${sent.id}`)).toHaveProp('contentFit', 'cover');
  });
  it('moves a conversation after the canonical cached summary gets a confirmed reply', async () => {
    const { subject, queries } = setup([untouched]);
    const view = await render(subject);
    await view.findByText('Start the conversation');
    await act(() =>
      queries.setQueryData(['conversations', owner], {
        pages: [
          { data: [{ ...sent, id: untouched.id, member: untouched.member }], nextCursor: null },
        ],
        pageParams: [undefined],
      }),
    );
    expect(await view.findByText('Their turn')).toBeTruthy();
    expect(view.queryByText('Your turn')).toBeNull();
  });
  it('loads the next cursor page once and keeps overlapping conversations unique', async () => {
    const { subject, conversations } = setup([untouched]);
    conversations
      .mockResolvedValueOnce({ data: [untouched], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ data: [untouched, sent], nextCursor: null });
    const view = await render(subject);
    await view.findByText('Start the conversation');
    expect(
      view.getByText('Counts reflect loaded connections. Load more to see the rest.'),
    ).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Load more connections' }));
    await view.findByText('Jamie');
    expect(view.getAllByText('Avery')).toHaveLength(1);
    expect(conversations).toHaveBeenCalledTimes(2);
    expect(conversations.mock.calls[1]?.[0]).toBe('next-page');
  });
  it('keeps cached conversations visible offline without replacing them with an empty state', async () => {
    const { subject, queries, conversations } = setup();
    queries.setQueryData(
      ['conversations', owner],
      {
        pages: [{ data: [untouched], nextCursor: null }],
        pageParams: [undefined],
      },
      { updatedAt: 0 },
    );
    onlineManager.setOnline(false);
    const view = await render(subject);
    expect(await view.findByText('Avery')).toBeTruthy();
    expect(view.getByText('Offline · showing connections saved on this device.')).toBeTruthy();
    expect(conversations).not.toHaveBeenCalled();
    expect(view.queryByText('No merges. Yet.')).toBeNull();
  });
  it('does not claim there are no matches when the first fetch is paused offline', async () => {
    const { subject } = setup();
    onlineManager.setOnline(false);
    const view = await render(subject);
    expect(await view.findByText('Your connections need a connection.')).toBeTruthy();
    expect(view.queryByText('No merges. Yet.')).toBeNull();
  });
  it('shows a genuine empty state after a successful empty response', async () => {
    const { subject } = setup([]);
    const view = await render(subject);
    expect(await view.findByText('No merges. Yet.')).toBeTruthy();
    expect(view.queryByText('Your turn')).toBeNull();
    expect(view.queryByText('Their turn')).toBeNull();
  });
  it('offers recovery after a failed fetch and retains the rest of the navigation', async () => {
    const { subject, conversations } = setup();
    conversations.mockRejectedValueOnce(new Error('Network unavailable.'));
    const view = await render(subject);
    expect(await view.findByText('Network unavailable.')).toBeTruthy();
    expect(view.queryByText('No merges. Yet.')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Retry loading connections' }));
    expect(await view.findByText('Avery')).toBeTruthy();
  });
  it('keeps cached rows visible on a refresh error', async () => {
    const { subject, queries, conversations } = setup();
    queries.setQueryData(
      ['conversations', owner],
      {
        pages: [{ data: [untouched], nextCursor: null }],
        pageParams: [undefined],
      },
      { updatedAt: 0 },
    );
    conversations.mockRejectedValue(new Error('Refresh failed.'));
    const view = await render(subject);
    expect(await view.findByText('Refresh failed.')).toBeTruthy();
    expect(view.getByText('Avery')).toBeTruthy();
  });
  it('allows retry when the messaging runtime cannot initialize', async () => {
    const { subject } = setup();
    const retry = jest.fn();
    jest
      .mocked(useMessaging)
      .mockReturnValue({ runtime: null, error: 'Could not open Merged.', retry });
    const view = await render(subject);
    expect(view.getByText('Could not open Merged.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry opening Merged' }));
    expect(retry).toHaveBeenCalled();
  });
  it('shows an accessible loading state while initialization is pending', async () => {
    const { queries } = setup();
    jest.mocked(useMessaging).mockReturnValue({ runtime: null, error: null, retry: jest.fn() });
    const view = await render(
      <QueryClientProvider client={queries}>
        <Text>Discover / Requests / Merged remain available</Text>
        <MergedInbox onOpenConversation={jest.fn()} />
      </QueryClientProvider>,
    );
    expect(view.getByLabelText('Loading connections')).toBeTruthy();
  });
});
