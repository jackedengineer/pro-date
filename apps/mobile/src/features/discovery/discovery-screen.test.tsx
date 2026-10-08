import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
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
  it('opens Merged immediately when an item like completes a reciprocal match', async () => {
    const api = actions();
    jest.mocked(api.send).mockResolvedValue({
      id: discoveryFixture.userId,
      status: 'MERGED',
      matchId: discoveryFixture.userId,
    });
    const merged = jest.fn();
    const view = await render(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        onMerged={merged}
        mergedInbox={<Text>Your turn</Text>}
      />,
    );
    await view.findByText('Avery, 28');
    await fireEvent.press(view.getByRole('button', { name: 'Like photo 1' }));
    await fireEvent.press(view.getByRole('button', { name: 'Send pull request' }));
    expect(await view.findByText('Your turn')).toBeTruthy();
    expect(merged).toHaveBeenCalledWith(discoveryFixture.userId);
    expect(view.getByRole('button', { name: 'Merged' })).toHaveProp('accessibilityState', {
      selected: true,
    });
  });
  it('keeps a failed merge in Requests without opening an unconfirmed chat', async () => {
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
          comment: '',
          createdAt: '2026-10-08T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    jest.mocked(api.respond).mockRejectedValue(new Error('Offline. Try merging again.'));
    const merged = jest.fn();
    const view = await render(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        onMerged={merged}
        mergedInbox={<Text>Your turn</Text>}
      />,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Requests' }));
    await view.findByRole('button', { name: 'Merge request from Avery' });
    await fireEvent.press(view.getByRole('button', { name: 'Merge request from Avery' }));
    expect(await view.findByText('Offline. Try merging again.')).toBeTruthy();
    expect(merged).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Requests' })).toHaveProp('accessibilityState', {
      selected: true,
    });
  });
  it('merges a received item like and opens the unified Merged inbox without a separate match gallery', async () => {
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
    const openConversation = jest.fn();
    const merged = jest.fn();
    const view = await render(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        onMerged={merged}
        mergedInbox={
          <View>
            <Text>Your turn</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chat with Avery"
              onPress={() => {
                openConversation(discoveryFixture.userId);
              }}
            >
              <Text>Avery</Text>
            </Pressable>
          </View>
        }
      />,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Requests' }));
    expect(await view.findByText('Tell me about this project.', { exact: false })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Merge request from Avery' }));
    await waitFor(() =>
      expect(api.respond).toHaveBeenCalledWith(discoveryFixture.userId, 'MERGED'),
    );
    expect(await view.findByText('Your turn')).toBeTruthy();
    expect(merged).toHaveBeenCalledWith(discoveryFixture.userId);
    expect(api.listMatches).not.toHaveBeenCalled();
    expect(view.queryByRole('button', { name: 'Messages' })).toBeNull();
    expect(view.getByRole('button', { name: 'Merged' })).toHaveProp('accessibilityState', {
      selected: true,
    });
    await fireEvent.press(view.getByRole('button', { name: 'Chat with Avery' }));
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
    const view = await render(
      <DiscoveryScreen actions={api} onOpenProfile={jest.fn()} mergedInbox={null} />,
    );
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
    const view = await render(
      <DiscoveryScreen actions={api} onOpenProfile={jest.fn()} mergedInbox={null} />,
    );
    await view.findByText('Avery, 28');
    await fireEvent.press(view.getByRole('button', { name: 'Report or block' }));
    await fireEvent.press(view.getByRole('button', { name: 'Block this member' }));
    await waitFor(() => expect(api.block).toHaveBeenCalledWith(discoveryFixture.userId));
    expect(await view.findByText('You’re all caught up.')).toBeTruthy();
    expect(api.pass).not.toHaveBeenCalled();
  });
  it('renders full photos and sends a request referencing exactly the selected prompt', async () => {
    const api = actions();
    const view = await render(
      <DiscoveryScreen actions={api} onOpenProfile={jest.fn()} mergedInbox={null} />,
    );
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
    const view = await render(
      <DiscoveryScreen actions={api} onOpenProfile={jest.fn()} mergedInbox={null} />,
    );
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
    const view = await render(
      <DiscoveryScreen actions={api} onOpenProfile={jest.fn()} mergedInbox={null} />,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Requests' }));
    expect(await view.findByText('Your next hello starts here.')).toBeTruthy();
    expect(api.respond).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Refresh requests' }));
    await waitFor(() => expect(api.inbox).toHaveBeenCalledTimes(2));
  });
  it('restores Merged from chat return navigation while keeping all three tabs available', async () => {
    const api = actions();
    const tabChanged = jest.fn();
    const view = await render(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        selectedTab="merged"
        onTabChange={tabChanged}
        mergedInbox={<Text>Your turn</Text>}
      />,
    );
    expect(view.getByText('Your turn')).toBeTruthy();
    expect(api.listMatches).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Discover' }));
    expect(tabChanged).toHaveBeenCalledWith('discover');
    await view.rerender(
      <DiscoveryScreen
        actions={api}
        onOpenProfile={jest.fn()}
        selectedTab="discover"
        onTabChange={tabChanged}
        mergedInbox={<Text>Your turn</Text>}
      />,
    );
    expect(await view.findByText('Avery, 28')).toBeTruthy();
  });
});
