import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MessageComposer } from './message-composer';

describe('chat composer', () => {
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
