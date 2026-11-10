import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountActionsContext } from '../account/account-actions';
import { asDiscoveryProfile, MyProfile } from './my-profile';
import { publishedReview } from './profile-test-fixtures';

describe('MyProfile', () => {
  it('opens on the profile as other people see it', async () => {
    const view = await render(
      <MyProfile
        loadProfileReview={jest.fn().mockResolvedValue(publishedReview)}
        onEdit={jest.fn()}
        onFinishSetup={jest.fn()}
      />,
    );

    expect(await view.findByText(/^Avery, \d+$/)).toBeTruthy();
    expect(view.getByText('Live. This is how you appear in Discover.')).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Preview' })).toHaveProp('accessibilityState', {
      selected: true,
    });
    // A preview has nothing to like and nothing to publish.
    expect(view.queryByRole('button', { name: /Like photo/ })).toBeNull();
    expect(view.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('shows only what the member chose to make visible', () => {
    const preview = asDiscoveryProfile(publishedReview);

    expect(preview).toMatchObject({ genderIdentity: 'Non-binary', pronouns: 'they/them' });
    expect(preview?.heightCm).toBeNull();
    expect(
      asDiscoveryProfile({
        ...publishedReview,
        profile: { ...publishedReview.profile, locationLabel: null },
      }),
    ).toBeNull();
  });

  it('turns each part of the profile into its own edit', async () => {
    const onEdit = jest.fn();
    const view = await render(
      <MyProfile
        loadProfileReview={jest.fn().mockResolvedValue(publishedReview)}
        onEdit={onEdit}
        onFinishSetup={jest.fn()}
      />,
    );

    await fireEvent.press(await view.findByRole('tab', { name: 'Edit' }));
    expect(view.getByText('Hidden on your profile.')).toBeTruthy();

    for (const [name, step] of [
      ['Edit name', 'name'],
      ['Edit photos', 'photos'],
      ['Edit prompts', 'prompts'],
      ['Edit height', 'height'],
    ] as const) {
      await fireEvent.press(view.getByRole('button', { name }));
      expect(onEdit).toHaveBeenLastCalledWith(step);
    }
  });

  it('sends an unfinished profile back to setup instead of pretending it is live', async () => {
    const onFinishSetup = jest.fn();
    const view = await render(
      <MyProfile
        loadProfileReview={jest.fn().mockResolvedValue({
          ...publishedReview,
          missingSections: ['PROMPTS'],
          prompts: [],
          publishedAt: null,
        })}
        onEdit={jest.fn()}
        onFinishSetup={onFinishSetup}
      />,
    );

    expect(await view.findByText('Your profile isn’t live yet')).toBeTruthy();
    expect(view.getByText('Finish your prompts to appear in Discover.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Finish profile' }));
    expect(onFinishSetup).toHaveBeenCalledTimes(1);
  });

  it('reloads after an edit and recovers from a failed load', async () => {
    const loadProfileReview = jest
      .fn()
      .mockRejectedValueOnce(new Error('The API is unavailable.'))
      .mockResolvedValue(publishedReview);
    const props = { loadProfileReview, onEdit: jest.fn(), onFinishSetup: jest.fn() };
    const view = await render(<MyProfile {...props} reloadKey={0} />);

    expect(await view.findByText('The API is unavailable.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry loading profile' }));
    expect(await view.findByText(/^Avery, \d+$/)).toBeTruthy();

    await view.rerender(<MyProfile {...props} reloadKey={1} />);
    await waitFor(() => expect(loadProfileReview).toHaveBeenCalledTimes(3));
  });

  it('offers the public pages and account deletion inside the app', async () => {
    const deleteAccount = jest.fn();
    const view = await render(
      <AccountActionsContext.Provider
        value={{ signOut: jest.fn(), isSigningOut: false, deleteAccount, isDeletingAccount: false }}
      >
        <MyProfile
          loadProfileReview={jest.fn().mockResolvedValue(publishedReview)}
          onEdit={jest.fn()}
          onFinishSetup={jest.fn()}
        />
      </AccountActionsContext.Provider>,
    );

    await view.findByText(/^Avery, \d+$/);
    for (const name of ['Privacy policy', 'Terms of use', 'Safety standards', 'Help and contact'])
      expect(view.getByRole('link', { name })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Sign out' })).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Delete account' }));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });
});
