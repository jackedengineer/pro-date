import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { ProfileOnboardingFlow } from './profile-onboarding-flow';

const newUser = {
  id: '729438da-99b3-4d3d-b566-bfe94401829b',
  onboardingStep: 'NAME' as const,
  onboardingStatus: 'NOT_STARTED' as const,
};

describe('ProfileOnboardingFlow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('introduces the profile journey and its signature language', async () => {
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={jest.fn()} />,
    );

    expect(view.getByText('Build a profile worth replying to.')).toBeTruthy();
    expect(view.getByText('Open a PR')).toBeTruthy();
    expect(view.getByText('Review PR')).toBeTruthy();
    expect(view.getByText('Merged')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Start building' })).toBeTruthy();
  });

  it('keeps the name question clear and validates before saving', async () => {
    const saveDisplayName = jest.fn();
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={saveDisplayName} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), 'A');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    expect(view.getByRole('alert')).toHaveTextContent(
      'Your name must be between 2 and 40 characters.',
    );
    expect(saveDisplayName).not.toHaveBeenCalled();
  });

  it('keeps the field geometry stable when focus changes', async () => {
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={jest.fn()} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    const input = view.getByLabelText('First name or chosen name');
    const getBorderWidth = () => {
      const inputStyle = (
        view.getByLabelText('First name or chosen name').props as {
          style: StyleProp<TextStyle>;
        }
      ).style;

      return StyleSheet.flatten(inputStyle)?.borderWidth;
    };
    const borderWidthBeforeFocus = getBorderWidth();

    await fireEvent(input, 'focus');

    expect(getBorderWidth()).toBe(borderWidthBeforeFocus);
  });

  it('uses the keyboard Done action as a single smooth submission', async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation();
    const saveDisplayName = jest.fn().mockResolvedValue({
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'BIRTHDAY',
    });
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={saveDisplayName} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    const input = view.getByLabelText('First name or chosen name');
    await fireEvent.changeText(input, 'Ada');
    await fireEvent(input, 'submitEditing');

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(saveDisplayName).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByText('Nice to meet you, Ada.')).toBeTruthy());
  });

  it('trims and saves the name before advancing to the next checkpoint', async () => {
    let resolveSave:
      | ((value: {
          displayName: string;
          onboardingStatus: 'IN_PROGRESS';
          onboardingStep: 'BIRTHDAY';
        }) => void)
      | undefined;
    const saveDisplayName = jest.fn(
      () =>
        new Promise<{
          displayName: string;
          onboardingStatus: 'IN_PROGRESS';
          onboardingStep: 'BIRTHDAY';
        }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={saveDisplayName} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), '  Ada  ');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    expect(view.getByRole('button', { name: 'Saving name' })).toBeDisabled();
    expect(saveDisplayName).toHaveBeenCalledWith('Ada');

    resolveSave?.({
      displayName: 'Ada',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 'BIRTHDAY',
    });

    await waitFor(() => expect(view.getByText('Nice to meet you, Ada.')).toBeTruthy());
    expect(view.getByText('Next: birthday')).toBeTruthy();
  });

  it('preserves the name and shows a recoverable save error', async () => {
    const saveDisplayName = jest.fn().mockRejectedValue(new Error('The API is unavailable.'));
    const view = await render(
      <ProfileOnboardingFlow initialUser={newUser} saveDisplayName={saveDisplayName} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), 'Ada');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(view.getByRole('alert')).toHaveTextContent('The API is unavailable.'),
    );
    expect(view.getByDisplayValue('Ada')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Save and continue' })).toBeEnabled();
  });

  it('resumes at the server-provided checkpoint after an app restart', async () => {
    const view = await render(
      <ProfileOnboardingFlow
        initialUser={{
          ...newUser,
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'BIRTHDAY',
        }}
        saveDisplayName={jest.fn()}
      />,
    );

    expect(view.getByText('Profile draft restored')).toBeTruthy();
    expect(view.getByText('Next: birthday')).toBeTruthy();
  });
});
