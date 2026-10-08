import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { DiscoveryActions } from '../../api/discovery';
import { DiscoveryScreen } from './discovery-screen';
import { discoveryFixture } from './discovery-fixtures';

function actions(): DiscoveryActions {
  return {
    browse: jest.fn().mockResolvedValue({ data: [discoveryFixture], nextCursor: null }),
    inbox: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    listMatches: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
    send: jest
      .fn()
      .mockResolvedValue({ id: discoveryFixture.userId, status: 'PENDING', matchId: null }),
    respond: jest.fn(),
    pass: jest.fn(),
    block: jest.fn(),
    report: jest.fn(),
  };
}
describe('DiscoveryScreen', () => {
  it('merges a received item like and reveals the durable connection on the Merged tab', async () => {
    const api = actions();
    jest.mocked(api.inbox).mockResolvedValue({
      data: [
        {
          id: discoveryFixture.userId,
          sender: discoveryFixture,
          target: {
            type: 'PROMPT',
            id: discoveryFixture.prompts[0]!.id,
            promptId: 'weekend_build',
            answer: 'I enjoy making thoughtful products with kind people.',
          },
          comment: 'Tell me about this project.',
          createdAt: '2026-10-08T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    jest.mocked(api.respond).mockResolvedValue({
      id: discoveryFixture.userId,
      status: 'MERGED',
      matchId: discoveryFixture.userId,
    });
    jest.mocked(api.listMatches).mockResolvedValue({
      data: [
        {
          id: discoveryFixture.userId,
          profile: discoveryFixture,
          createdAt: '2026-10-08T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    const openConversation = jest.fn();
    const view = await render(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        onOpenConversation={openConversation}
      />,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Requests' }));
    expect(await view.findByText('Tell me about this project.', { exact: false })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Merge request from Avery' }));
    await waitFor(() =>
      expect(api.respond).toHaveBeenCalledWith(discoveryFixture.userId, 'MERGED'),
    );
    expect(await view.findByText('Merged. Find your new connection in Merged.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Merged' }));
    expect(await view.findByRole('button', { name: "View Avery's profile" })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Message Avery' }));
    expect(openConversation).toHaveBeenCalledWith(discoveryFixture.userId);
  });
  it('loads the next cursor page after passing the last profile in a batch', async () => {
    const api = actions();
    jest
      .mocked(api.browse)
      .mockResolvedValueOnce({ data: [discoveryFixture], nextCursor: 'next-test-cursor' })
      .mockResolvedValueOnce({
        data: [
          {
            ...discoveryFixture,
            userId: '10000000-0000-4000-8000-000000000099',
            displayName: 'Jamie',
          },
        ],
        nextCursor: null,
      });
    const view = await render(<DiscoveryScreen actions={api} onOpenProfile={jest.fn()} />);
    await view.findByText('Avery, 28');
    await fireEvent.press(view.getByRole('button', { name: 'Pass · see next profile' }));
    expect(await view.findByText('Jamie, 28')).toBeTruthy();
    expect(api.browse).toHaveBeenLastCalledWith(
      { radiusKm: 50, minAge: 18, maxAge: 99 },
      'next-test-cursor',
    );
  });
  it('blocks a member and removes their profile only after the server confirms', async () => {
    const api = actions();
    const view = await render(<DiscoveryScreen actions={api} onOpenProfile={jest.fn()} />);
    await view.findByText('Avery, 28');
    await fireEvent.press(view.getByRole('button', { name: 'Report or block' }));
    await fireEvent.press(view.getByRole('button', { name: 'Block this member' }));
    await waitFor(() => expect(api.block).toHaveBeenCalledWith(discoveryFixture.userId));
    expect(await view.findByText('You’re all caught up.')).toBeTruthy();
    expect(api.pass).not.toHaveBeenCalled();
  });
  it('renders full photos and sends a request referencing exactly the selected prompt', async () => {
    const api = actions();
    const view = await render(<DiscoveryScreen actions={api} onOpenProfile={jest.fn()} />);
    await view.findByText('Avery, 28');
    expect(view.getByTestId('discovery-photo-0')).toHaveProp('contentFit', 'cover');
    await fireEvent.press(view.getByRole('button', { name: 'Like prompt 1' }));
    await fireEvent.changeText(
      view.getByLabelText('Opening comment (optional)'),
      'What would you build next?',
    );
    await fireEvent.press(view.getByRole('button', { name: 'Send pull request' }));
    await waitFor(() =>
      expect(api.send).toHaveBeenCalledWith({
        recipientUserId: discoveryFixture.userId,
        targetType: 'PROMPT',
        targetId: discoveryFixture.prompts[0]!.id,
        comment: 'What would you build next?',
      }),
    );
    expect(await view.findByText('You’re all caught up.')).toBeTruthy();
  });
  it('keeps the selected profile and draft comment after a failed send', async () => {
    const api = actions();
    jest.mocked(api.send).mockRejectedValue(new Error('That photo changed. Refresh this profile.'));
    const view = await render(<DiscoveryScreen actions={api} onOpenProfile={jest.fn()} />);
    await view.findByText('Avery, 28');
    await fireEvent.press(view.getByRole('button', { name: 'Like photo 2' }));
    await fireEvent.changeText(
      view.getByLabelText('Opening comment (optional)'),
      'Looks like a fun weekend.',
    );
    await fireEvent.press(view.getByRole('button', { name: 'Send pull request' }));
    expect(await view.findByText('That photo changed. Refresh this profile.')).toBeTruthy();
    expect(view.getByLabelText('Opening comment (optional)')).toHaveProp(
      'value',
      'Looks like a fun weekend.',
    );
    expect(api.pass).not.toHaveBeenCalled();
  });
  it('keeps empty requests honest and lets the user retry loading', async () => {
    const api = actions();
    const view = await render(<DiscoveryScreen actions={api} onOpenProfile={jest.fn()} />);
    await fireEvent.press(view.getByRole('button', { name: 'Requests' }));
    expect(await view.findByText('Your next hello starts here.')).toBeTruthy();
    expect(api.respond).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Refresh requests' }));
    await waitFor(() => expect(api.inbox).toHaveBeenCalledTimes(2));
  });
});
