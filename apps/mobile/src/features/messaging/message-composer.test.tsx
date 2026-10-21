import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MessageComposer } from './message-composer';

describe('chat composer', () => {
  it('shows a cancellable quote without replacing the typed draft', async () => {
    const cancel = jest.fn();
    const view = await render(
      <MessageComposer
        onSend={jest.fn()}
        disabled={false}
        bottomInset={0}
        replyTo={{
          messageId: '10000000-0000-4000-8000-000000000001',
          senderId: '10000000-0000-4000-8000-000000000002',
          excerpt: 'A small thoughtful message',
        }}
        onCancelReply={cancel}
      />,
    );
    await fireEvent.changeText(view.getByLabelText('Message'), 'my draft');
    expect(view.getByText('A small thoughtful message')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel reply' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText('Message').props.value).toBe('my draft');
  });
  it('keeps a failed draft and clears only after the outgoing intent is saved', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('Could not save'))
      .mockResolvedValue(undefined);
    const view = await render(<MessageComposer onSend={send} disabled={false} bottomInset={0} />);
    await fireEvent.changeText(view.getByLabelText('Message'), 'Hello\nAvery');
    await fireEvent.press(view.getByRole('button', { name: 'Send message' }));
    expect(await view.findByText('Could not save')).toBeTruthy();
    expect(view.getByLabelText('Message').props.value).toBe('Hello\nAvery');
    await fireEvent.press(view.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(view.getByLabelText('Message').props.value).toBe(''));
    expect(send).toHaveBeenLastCalledWith('Hello\nAvery');
  });
  it('supports multiline text and disables empty sends', async () => {
    const view = await render(
      <MessageComposer onSend={jest.fn()} disabled={false} bottomInset={0} />,
    );
    expect(view.getByLabelText('Message').props.multiline).toBe(true);
    expect(view.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
