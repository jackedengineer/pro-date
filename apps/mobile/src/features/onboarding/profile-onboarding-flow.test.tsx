import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import type { ProfileCheckpoint } from '../../api/profile';
import type { ProfileReview } from '@pro-date/contracts';
import { ProfileOnboardingFlow } from './profile-onboarding-flow';

const newUser = {
  id: '729438da-99b3-4d3d-b566-bfe94401829b',
  onboardingStep: 'NAME' as const,
  onboardingStatus: 'NOT_STARTED' as const,
};

const profileReview: ProfileReview = {
  missingSections: [],
  photos: Array.from({ length: 4 }, (_, position) => ({
    deliveryUrl: `https://res.cloudinary.com/pro-date-dev/image/upload/profile-${position}.jpg`,
    height: 1600,
    id: `00000000-0000-4000-8000-${(position + 1).toString().padStart(12, '0')}`,
    position,
    width: 1200,
  })),
  profile: {
    arePronounsVisible: true,
    birthDate: '1998-08-19',
    displayName: 'Avery',
    genderIdentity: 'Non-binary',
    hasLocation: true,
    heightCm: 173,
    interestedIn: ['WOMEN'],
    isGenderVisible: true,
    isHeightVisible: true,
    locationLabel: 'Bengaluru, Karnataka',
    onboardingStatus: 'IN_PROGRESS',
    onboardingStep: 'REVIEW',
    pronouns: 'they/them',
    relationshipIntent: 'LONG_TERM',
  },
  prompts: [
    {
      answer: 'I build tiny tools that make creative work feel lighter.',
      id: '10000000-0000-4000-8000-000000000001',
      position: 0,
      promptId: 'weekend_build',
    },
    {
      answer: 'Coffee, a long walk, and one wildly specific playlist.',
      id: '10000000-0000-4000-8000-000000000002',
      position: 1,
      promptId: 'debug_bad_day',
    },
    {
      answer: 'Curious questions, kind reviews, and excellent snack choices.',
      id: '10000000-0000-4000-8000-000000000003',
      position: 2,
      promptId: 'merge_criteria',
    },
  ],
  publishedAt: null,
};

const foundationProps = {
  captureLocation: jest.fn(),
  completePhotos: jest.fn(),
  completePrompts: jest.fn(),
  loadPhotos: jest.fn().mockResolvedValue([]),
  loadProfileReview: jest.fn().mockResolvedValue(profileReview),
  loadPrompts: jest.fn().mockResolvedValue([]),
  pickPhoto: jest.fn(),
  publishProfile: jest.fn(),
  removePhoto: jest.fn(),
  saveHeight: jest.fn(),
  saveIdentity: jest.fn(),
  saveLocation: jest.fn(),
  savePreferences: jest.fn(),
  uploadPhoto: jest.fn(),
};

function profileCheckpoint(overrides: Partial<ProfileCheckpoint> = {}): ProfileCheckpoint {
  return {
    arePronounsVisible: true,
    birthDate: null,
    displayName: null,
    genderIdentity: null,
    hasLocation: false,
    heightCm: null,
    interestedIn: [],
    isGenderVisible: true,
    isHeightVisible: true,
    locationLabel: null,
    onboardingStatus: 'IN_PROGRESS',
    onboardingStep: 'IDENTITY',
    pronouns: null,
    relationshipIntent: null,
    ...overrides,
  };
}

describe('ProfileOnboardingFlow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('introduces the profile journey and its signature language', async () => {
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={jest.fn()}
      />,
    );

    expect(view.getByText('Build a profile worth replying to.')).toBeTruthy();
    expect(view.getByText('Draft sync: on')).toBeTruthy();
    expect(view.getByText('The interaction model')).toBeTruthy();
    expect(view.getByText('Open a PR')).toBeTruthy();
    expect(view.getByText('Review PR')).toBeTruthy();
    expect(view.getByText('Merged')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Start building' })).toBeTruthy();
  });

  it('keeps the name question clear and validates before saving', async () => {
    const saveDisplayName = jest.fn();
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={saveDisplayName}
      />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    expect(view.getByText('What name are we shipping?')).toBeTruthy();
    expect(view.getByText('First name or chosen name—whatever feels most you.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), 'A');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    expect(view.getByRole('alert')).toHaveTextContent(
      'Your name must be between 2 and 40 characters.',
    );
    expect(saveDisplayName).not.toHaveBeenCalled();
  });

  it('keeps the field geometry stable when focus changes', async () => {
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={jest.fn()}
      />,
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
    const saveDisplayName = jest.fn().mockResolvedValue(
      profileCheckpoint({
        displayName: 'Ada',
        onboardingStep: 'BIRTHDAY',
      }),
    );
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={saveDisplayName}
      />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    const input = view.getByLabelText('First name or chosen name');
    await fireEvent.changeText(input, 'Ada');
    await fireEvent(input, 'submitEditing');

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(saveDisplayName).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByText('One quick age check.')).toBeTruthy());
  });

  it('trims and saves the name before advancing to the next checkpoint', async () => {
    let resolveSave: ((value: ProfileCheckpoint) => void) | undefined;
    const saveDisplayName = jest.fn(
      () =>
        new Promise<ProfileCheckpoint>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={saveDisplayName}
      />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Start building' }));
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), '  Ada  ');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    expect(view.getByRole('button', { name: 'Saving name' })).toBeDisabled();
    expect(saveDisplayName).toHaveBeenCalledWith('Ada');

    resolveSave?.(
      profileCheckpoint({
        displayName: 'Ada',
        onboardingStep: 'BIRTHDAY',
      }),
    );

    await waitFor(() => expect(view.getByText('One quick age check.')).toBeTruthy());
  });

  it('preserves the name and shows a recoverable save error', async () => {
    const saveDisplayName = jest.fn().mockRejectedValue(new Error('The API is unavailable.'));
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={newUser}
        saveBirthDate={jest.fn()}
        saveDisplayName={saveDisplayName}
      />,
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
        {...foundationProps}
        initialUser={{
          ...newUser,
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'BIRTHDAY',
        }}
        saveBirthDate={jest.fn()}
        saveDisplayName={jest.fn()}
      />,
    );

    expect(view.getByText('One quick age check.')).toBeTruthy();
  });

  it('saves the birthday before advancing to the identity checkpoint', async () => {
    const saveBirthDate = jest.fn().mockResolvedValue(
      profileCheckpoint({
        birthDate: '2000-02-29',
        displayName: 'Ada',
      }),
    );
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={{
          ...newUser,
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'BIRTHDAY',
        }}
        saveBirthDate={saveBirthDate}
        saveDisplayName={jest.fn()}
      />,
    );

    await fireEvent(
      view.getByTestId('birthday-picker'),
      'valueChange',
      { nativeEvent: { timestamp: new Date(2000, 1, 29).getTime(), utcOffset: 0 } },
      new Date(2000, 1, 29),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Save birthday and continue' }));

    expect(saveBirthDate).toHaveBeenCalledWith('2000-02-29');
    await waitFor(() => expect(view.getByText('How do you identify?')).toBeTruthy());
  });

  it('saves every basic profile section before handing off to photos', async () => {
    const captureLocation = jest.fn().mockResolvedValue({
      countryCode: 'IN',
      latitude: 19.076,
      locality: 'Mumbai',
      longitude: 72.8777,
      region: 'Maharashtra',
    });
    const saveIdentity = jest.fn().mockResolvedValue(
      profileCheckpoint({
        genderIdentity: 'Non-binary',
        onboardingStep: 'PREFERENCES',
        pronouns: 'they/them',
      }),
    );
    const savePreferences = jest.fn().mockResolvedValue(
      profileCheckpoint({
        interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
        onboardingStep: 'LOCATION',
        relationshipIntent: 'LONG_TERM',
      }),
    );
    const saveLocation = jest.fn().mockResolvedValue(
      profileCheckpoint({
        hasLocation: true,
        locationLabel: 'Mumbai, Maharashtra',
        onboardingStep: 'DETAILS',
      }),
    );
    const saveHeight = jest
      .fn()
      .mockResolvedValue(profileCheckpoint({ heightCm: 173, onboardingStep: 'PHOTOS' }));
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        captureLocation={captureLocation}
        initialUser={{
          ...newUser,
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'IDENTITY',
        }}
        saveBirthDate={jest.fn()}
        saveDisplayName={jest.fn()}
        saveHeight={saveHeight}
        saveIdentity={saveIdentity}
        saveLocation={saveLocation}
        savePreferences={savePreferences}
      />,
    );

    await fireEvent.press(view.getByRole('radio', { name: 'Non-binary' }));
    await fireEvent.press(view.getByRole('radio', { name: 'they/them' }));
    await fireEvent.press(view.getByRole('button', { name: 'Save identity and continue' }));

    await waitFor(() => expect(view.getByText('Who should make your queue?')).toBeTruthy());
    await fireEvent.press(view.getByRole('checkbox', { name: 'Women' }));
    await fireEvent.press(view.getByRole('checkbox', { name: 'Non-binary people' }));
    await fireEvent.press(view.getByRole('radio', { name: 'Long-term relationship' }));
    await fireEvent.press(view.getByRole('button', { name: 'Save preferences and continue' }));

    await waitFor(() => expect(view.getByText('Set your discovery area.')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Use my location' }));

    await waitFor(() => expect(view.getByText('Add your height.')).toBeTruthy());
    await fireEvent(view.getByTestId('height-picker'), 'valueChange', 173, 53);
    await fireEvent.press(view.getByRole('button', { name: 'Save height and continue' }));

    await waitFor(() => expect(view.getByText('Show the build, not just the bio.')).toBeTruthy());
    expect(saveIdentity).toHaveBeenCalledWith({
      arePronounsVisible: true,
      genderIdentity: 'Non-binary',
      isGenderVisible: true,
      pronouns: 'they/them',
    });
    expect(savePreferences).toHaveBeenCalledWith({
      interestedIn: ['WOMEN', 'NON_BINARY_PEOPLE'],
      relationshipIntent: 'LONG_TERM',
    });
    expect(saveLocation).toHaveBeenCalledWith(expect.objectContaining({ locality: 'Mumbai' }));
    expect(saveHeight).toHaveBeenCalledWith({ centimeters: 173, isVisible: true });
  });

  it.each([
    ['IDENTITY', 'How do you identify?'],
    ['PREFERENCES', 'Who should make your queue?'],
    ['LOCATION', 'Set your discovery area.'],
    ['DETAILS', 'Add your height.'],
    ['PHOTOS', 'Show the build, not just the bio.'],
    ['PROMPTS', 'Give them something to reply to.'],
    ['REVIEW', "Preview the profile you're shipping."],
  ] as const)('resumes %s at its dedicated screen', async (onboardingStep, heading) => {
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={{ ...newUser, onboardingStatus: 'IN_PROGRESS', onboardingStep }}
        saveBirthDate={jest.fn()}
        saveDisplayName={jest.fn()}
      />,
    );

    expect(view.getByText(heading)).toBeTruthy();
  });

  it('returns directly to review after editing a published profile field', async () => {
    const saveDisplayName = jest.fn().mockResolvedValue({
      ...profileReview.profile,
      displayName: 'Avery K',
    });
    const view = await render(
      <ProfileOnboardingFlow
        {...foundationProps}
        initialUser={{ ...newUser, onboardingStatus: 'IN_PROGRESS', onboardingStep: 'REVIEW' }}
        saveBirthDate={jest.fn()}
        saveDisplayName={saveDisplayName}
      />,
    );

    await view.findByText(/Avery,/);
    await fireEvent.press(view.getByRole('button', { name: 'Edit name' }));
    expect(view.getByDisplayValue('Avery')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('First name or chosen name'), 'Avery K');
    await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));

    expect(saveDisplayName).toHaveBeenCalledWith('Avery K');
    await waitFor(() =>
      expect(view.getByText("Preview the profile you're shipping.")).toBeTruthy(),
    );
  });
});
