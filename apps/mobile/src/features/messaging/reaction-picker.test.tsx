import { fireEvent, render } from '@testing-library/react-native';
import { ReactionPicker } from './reaction-picker';
import type { ChatRow } from './chat-thread';
const row: ChatRow = {
  key: 'saved',
  messageId: '10000000-0000-4000-8000-000000000001',
  conversationId: '10000000-0000-4000-8000-000000000002',
  senderId: 'owner',
  clientId: 'intent',
  body: 'A thoughtful hello',
  createdAt: '2026-10-08T00:00:00Z',
  sequence: 1,
  status: 'sent',
  failure: null,
  replyTo: null,
  reactionPending: false,
  reactionError: null,
  context: {
    messageId: '10000000-0000-4000-8000-000000000001',
    revision: 1,
    replyTo: null,
    reactions: [{ userId: 'owner', reaction: 'HEART', revision: 1 }],
  },
};
describe('curated message actions', () => {
  it('offers exactly six accessible reactions and identifies tap-to-remove', async () => {
    const react = jest.fn();
    const view = await render(
      <ReactionPicker
        row={row}
        ownerId="owner"
        online
        onClose={jest.fn()}
        onReply={jest.fn()}
        onReact={react}
        onRefresh={jest.fn()}
      />,
    );
    expect(view.getAllByRole('button', { name: /reaction$/ })).toHaveLength(6);
    const heart = view.getByRole('button', { name: 'Remove Heart reaction' });
    expect(heart.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(heart);
    expect(react).toHaveBeenCalledWith(row.messageId, 'HEART');
  });
  it('explains offline availability without disabling Reply', async () => {
    const reply = jest.fn();
    const view = await render(
      <ReactionPicker
        row={row}
        ownerId="owner"
        online={false}
        onClose={jest.fn()}
        onReply={reply}
        onReact={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(view.getByText('Connect to change reactions. Replies can stay queued.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Remove Heart reaction' })).toBeDisabled();
    await fireEvent.press(view.getByRole('button', { name: 'Reply' }));
    expect(reply).toHaveBeenCalledWith(row.messageId);
  });
});
