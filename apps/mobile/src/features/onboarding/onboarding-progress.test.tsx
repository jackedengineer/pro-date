import { render } from '@testing-library/react-native';

import { OnboardingModeContext } from './onboarding-mode';
import { onboardingChapter, OnboardingProgress } from './onboarding-progress';

describe('OnboardingProgress', () => {
  it('groups nine steps into three chapters', () => {
    expect([1, 3, 4, 6, 7, 9].map((step) => onboardingChapter(step, 9).name)).toEqual([
      'About you',
      'About you',
      'The details',
      'The details',
      'Show yourself',
      'Show yourself',
    ]);
    expect(onboardingChapter(2, 9).progress).toBeCloseTo(2 / 3);
    expect(onboardingChapter(9, 9).progress).toBe(1);
  });

  it('names the chapter and still reports the exact step to screen readers', async () => {
    const view = await render(<OnboardingProgress current={5} total={9} />);

    expect(view.getByText('The details')).toBeTruthy();
    expect(view.getByLabelText('Profile setup, step 5 of 9')).toBeTruthy();
  });

  it('is absent when a single part of a finished profile is being edited', async () => {
    const view = await render(
      <OnboardingModeContext.Provider value="edit">
        <OnboardingProgress current={5} total={9} />
      </OnboardingModeContext.Provider>,
    );

    expect(view.queryByRole('progressbar')).toBeNull();
  });
});
