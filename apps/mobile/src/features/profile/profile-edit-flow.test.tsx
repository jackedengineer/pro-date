import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { ProfileOnboardingFlowProps } from '../onboarding/profile-onboarding-flow';
import { ProfileEditFlow } from './profile-edit-flow';
import { publishedReview } from './profile-test-fixtures';

function actions(overrides: Partial<ProfileOnboardingFlowProps> = {}) {
  return {
    captureLocation: jest.fn(),
    completePhotos: jest.fn(),
    completePrompts: jest.fn(),
    loadPhotos: jest.fn(),
    loadProfileReview: jest.fn().mockResolvedValue(publishedReview),
    loadPrompts: jest.fn(),
    pickPhoto: jest.fn(),
    publishProfile: jest.fn(),
    removePhoto: jest.fn(),
    saveBirthDate: jest.fn(),
    saveDisplayName: jest.fn().mockResolvedValue(publishedReview.profile),
    saveHeight: jest.fn(),
    saveIdentity: jest.fn(),
    saveLocation: jest.fn(),
    savePreferences: jest.fn(),
    uploadPhoto: jest.fn(),
    ...overrides,
  } satisfies Omit<ProfileOnboardingFlowProps, 'initialUser' | 'edit'>;
}

describe('ProfileEditFlow', () => {
  it('opens one step on its own, pre-filled, and saves without publishing again', async () => {
    const onDone = jest.fn();
    const props = actions();
    const view = await render(<ProfileEditFlow {...props} step="name" onDone={onDone} />);

    const input = await view.findByLabelText('First name or chosen name');
    expect(input).toHaveProp('value', 'Avery');
    // Not a step in a sequence: no progress, and the button says what it does.
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.queryByText('Continue')).toBeNull();

    await fireEvent.changeText(input, 'Ave');
    await fireEvent.press(view.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(props.saveDisplayName).toHaveBeenCalledWith('Ave');
    expect(props.publishProfile).not.toHaveBeenCalled();
  });

  it('closes without saving', async () => {
    const onDone = jest.fn();
    const props = actions();
    const view = await render(<ProfileEditFlow {...props} step="name" onDone={onDone} />);

    await view.findByLabelText('First name or chosen name');
    await fireEvent.press(view.getByRole('button', { name: 'Close without saving' }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(props.saveDisplayName).not.toHaveBeenCalled();
  });

  it('says nothing changed when the profile cannot be loaded', async () => {
    const onDone = jest.fn();
    const view = await render(
      <ProfileEditFlow
        {...actions({ loadProfileReview: jest.fn().mockRejectedValue(new Error('Offline.')) })}
        step="height"
        onDone={onDone}
      />,
    );

    expect(await view.findByText('Offline.')).toBeTruthy();
    expect(view.getByText('Nothing was changed.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Close' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
