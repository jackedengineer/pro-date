import { fireEvent, render } from '@testing-library/react-native';
import { MessageReactions } from './message-reactions';
import type { ChatRow } from './chat-thread';

const row: ChatRow = {
  key: 'saved',
  messageId: 'message',
  conversationId: 'chat',
  senderId: 'owner',
  clientId: 'intent',
  body: 'Hello',
  createdAt: '2026-10-21T12:00:00Z',
  sequence: 1,
  status: 'sent',
  failure: null,
  replyTo: null,
  reactionPending: false,
  reactionError: null,
  context: {
    messageId: 'message',
    revision: 1,
    replyTo: null,
    reactions: [{ userId: 'owner', reaction: 'HEART', revision: 1 }],
  },
};

describe('compact bubble reactions', () => {
  it('uses a small overlapping badge with a full touch target and no redundant single count', async () => {
    const react = jest.fn();
    const view = await render(
      <MessageReactions row={row} ownerId="owner" online react={react} refresh={jest.fn()} />,
    );
    const button = view.getByRole('button', { name: 'Remove Heart reaction, 1 person' });
    expect(button).toHaveStyle({ minWidth: 44, height: 44 });
    expect(view.getByTestId('reaction-badge-HEART')).toHaveStyle({ height: 26 });
    expect(view.getByTestId('message-reaction-badges')).toHaveStyle({ marginTop: -16 });
    expect(view.getByText('❤️')).toHaveStyle({ fontSize: 16 });
    expect(view.queryByText(/✓|^1$/)).toBeNull();
    await fireEvent.press(button);
    expect(react).toHaveBeenCalledWith('message', 'HEART');
  });
  it('shows an immediate replacement without a saving label, but keeps failure recovery', async () => {
    const view = await render(
      <MessageReactions
        row={{ ...row, reactionPending: true, pendingReaction: 'FIRE' }}
        ownerId="owner"
        online
        react={jest.fn()}
        refresh={jest.fn()}
      />,
    );
    expect(view.queryByText('Saving reaction…')).toBeNull();
    expect(view.queryByText('❤️')).toBeNull();
    expect(view.getByRole('button', { name: 'Remove Fire reaction, 1 person' })).toBeDisabled();
    const refresh = jest.fn();
    await view.rerender(
      <MessageReactions
        row={{ ...row, reactionError: 'Refresh to confirm.' }}
        ownerId="owner"
        online
        react={jest.fn()}
        refresh={refresh}
      />,
    );
    expect(view.getByRole('alert')).toHaveTextContent('Refresh to confirm.');
    await fireEvent.press(view.getByRole('button', { name: 'Refresh reaction' }));
    expect(refresh).toHaveBeenCalledWith('message');
  });
  it('combines shared reactions and keeps the other member visible during optimistic removal', async () => {
    const shared: ChatRow = {
      ...row,
      context: {
        ...row.context!,
        reactions: [...row.context!.reactions, { userId: 'other', reaction: 'HEART', revision: 1 }],
      },
    };
    const view = await render(
      <MessageReactions
        row={shared}
        ownerId="owner"
        online
        react={jest.fn()}
        refresh={jest.fn()}
      />,
    );
    expect(view.getByText('2')).toBeTruthy();
    await view.rerender(
      <MessageReactions
        row={{ ...shared, pendingReaction: null, reactionPending: true }}
        ownerId="owner"
        online
        react={jest.fn()}
        refresh={jest.fn()}
      />,
    );
    expect(view.getByRole('button', { name: 'Add Heart reaction, 1 person' })).toBeDisabled();
    expect(view.queryByText('2')).toBeNull();
  });
});
