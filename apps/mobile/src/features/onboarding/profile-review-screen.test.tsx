import type { ProfileReview } from '@pro-date/contracts';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProfileReviewScreen } from './profile-review-screen';

const review: ProfileReview = {
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

const editCallbacks = {
  onEditBirthday: jest.fn(),
  onEditHeight: jest.fn(),
  onEditIdentity: jest.fn(),
  onEditLocation: jest.fn(),
  onEditName: jest.fn(),
  onEditPhotos: jest.fn(),
  onEditPreferences: jest.fn(),
  onEditPrompts: jest.fn(),
};

describe('ProfileReviewScreen', () => {
  it('can review an already-published profile and return to the published actions after saving', async () => {
    const published: ProfileReview = { ...review, publishedAt: '2026-10-08T00:00:00.000Z' };
    const onDiscover = jest.fn();
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        onDiscover={onDiscover}
        loadProfileReview={jest.fn().mockResolvedValue(published)}
        publishProfile={jest.fn().mockResolvedValue(published)}
      />,
    );
    await fireEvent.press(await view.findByRole('button', { name: 'Review my profile' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Publish profile' }));
    await fireEvent.press(await view.findByRole('button', { name: 'Explore profiles' }));
    expect(onDiscover).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the real discovery preview from server-owned profile data', async () => {
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        loadProfileReview={jest.fn().mockResolvedValue(review)}
        publishProfile={jest.fn()}
      />,
    );

    expect(await view.findByText("Preview the profile you're shipping.")).toBeTruthy();
    expect(view.getByTestId('review-lead-photo')).toHaveProp('contentFit', 'cover');
    expect(view.getByText(/Avery,/)).toBeTruthy();
    expect(view.getByText('Bengaluru, Karnataka')).toBeTruthy();
    expect(view.getByText('Non-binary')).toBeTruthy();
    expect(view.getByText('they/them')).toBeTruthy();
    expect(view.getByText('The thing I would happily spend a weekend building is…')).toBeTruthy();
    expect(view.getByText('I build tiny tools that make creative work feel lighter.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Publish profile' })).toBeEnabled();
  });

  it('honors profile visibility controls in the preview', async () => {
    const hiddenReview: ProfileReview = {
      ...review,
      profile: {
        ...review.profile,
        arePronounsVisible: false,
        isGenderVisible: false,
        isHeightVisible: false,
      },
    };
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        loadProfileReview={jest.fn().mockResolvedValue(hiddenReview)}
        publishProfile={jest.fn()}
      />,
    );

    await view.findByText(/Avery,/);
    expect(view.queryByText('Non-binary')).toBeNull();
    expect(view.queryByText('they/them')).toBeNull();
    expect(view.queryByText('173 cm')).toBeNull();
  });

  it('offers direct edits without losing the review checkpoint', async () => {
    const onEditPhotos = jest.fn();
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        loadProfileReview={jest.fn().mockResolvedValue(review)}
        onEditPhotos={onEditPhotos}
        publishProfile={jest.fn()}
      />,
    );

    await view.findByText(/Avery,/);
    await fireEvent.press(view.getByRole('button', { name: 'Edit photos' }));

    expect(onEditPhotos).toHaveBeenCalledTimes(1);
  });

  it('publishes once and shows an honest completion state', async () => {
    const published: ProfileReview = {
      ...review,
      profile: {
        ...review.profile,
        onboardingStatus: 'COMPLETE',
        onboardingStep: 'COMPLETE',
      },
      publishedAt: '2026-10-07T08:45:30.000Z',
    };
    const publishProfile = jest.fn().mockResolvedValue(published);
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        loadProfileReview={jest.fn().mockResolvedValue(review)}
        publishProfile={publishProfile}
      />,
    );

    await fireEvent.press(await view.findByRole('button', { name: 'Publish profile' }));

    expect(publishProfile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.getByText('Your profile is live.')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Review my profile' })).toBeTruthy();
  });

  it('keeps load failures recoverable', async () => {
    const loadProfileReview = jest
      .fn()
      .mockRejectedValueOnce(new Error('The API is unavailable.'))
      .mockResolvedValueOnce(review);
    const view = await render(
      <ProfileReviewScreen
        {...editCallbacks}
        loadProfileReview={loadProfileReview}
        publishProfile={jest.fn()}
      />,
    );

    expect(await view.findByText('The API is unavailable.')).toBeTruthy();
    expect(view.getByRole('alert')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Retry profile review' }));
    await waitFor(() => expect(view.getByText(/Avery,/)).toBeTruthy());
    expect(loadProfileReview).toHaveBeenCalledTimes(2);
  });
});
