import { fireEvent, render } from '@testing-library/react-native';
import { ReactionPicker } from './reaction-picker';
import type { ChatRow } from './chat-thread';
import { Animated } from 'react-native';
import { MotionProvider } from '../../theme/motion';
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
  afterEach(() => jest.restoreAllMocks());
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
  it('uses one compact emoji row with no visible labels or progress copy', async () => {
    const view = await render(
      <ReactionPicker
        row={{ ...row, reactionPending: true }}
        ownerId="owner"
        online
        onClose={jest.fn()}
        onReply={jest.fn()}
        onReact={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(view.queryByText('Saving reaction…')).toBeNull();
    expect(view.queryByText('Message actions')).toBeNull();
    expect(view.queryByText('Heart ✓')).toBeNull();
    expect(view.getByTestId('reaction-picker-pill')).toHaveProp('horizontal', true);
    expect(view.getByRole('button', { name: 'Remove Heart reaction' })).toHaveStyle({
      width: 44,
      height: 44,
    });
    expect(view.getByText('❤️')).toHaveStyle({ fontSize: 24 });
  });
  it('uses a short native-driven entrance, not a new animation for every context update', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const source = {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove: jest.fn() }),
    };
    const subject = (value: ChatRow) => (
      <MotionProvider source={source}>
        <ReactionPicker
          row={value}
          ownerId="owner"
          online
          onClose={jest.fn()}
          onReply={jest.fn()}
          onReact={jest.fn()}
          onRefresh={jest.fn()}
        />
      </MotionProvider>
    );
    const view = await render(subject(row));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 120, useNativeDriver: true, isInteraction: false }),
    );
    await view.rerender(subject({ ...row, reactionPending: true }));
    expect(timing).toHaveBeenCalledTimes(1);
  });
  it('keeps reduced-motion feedback static and supports explicit close', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const close = jest.fn();
    const view = await render(
      <ReactionPicker
        row={row}
        ownerId="owner"
        online
        onClose={close}
        onReply={null}
        onReact={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(timing).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Close message actions' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
