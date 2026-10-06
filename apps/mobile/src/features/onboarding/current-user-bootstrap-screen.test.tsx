import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { CurrentUserBootstrapScreen } from './current-user-bootstrap-screen';

const currentUser = {
  id: '729438da-99b3-4d3d-b566-bfe94401829b',
  onboardingStep: 'NAME' as const,
  onboardingStatus: 'NOT_STARTED' as const,
};

describe('CurrentUserBootstrapScreen', () => {
  it('shows progress and then the profile onboarding introduction', async () => {
    let resolveBootstrap: ((value: typeof currentUser) => void) | undefined;
    const bootstrap = jest.fn(
      () =>
        new Promise<typeof currentUser>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    const view = await render(
      <CurrentUserBootstrapScreen bootstrap={bootstrap} saveDisplayName={jest.fn()} />,
    );

    expect(view.getByText('Preparing your profile')).toBeTruthy();
    await act(() => {
      resolveBootstrap?.(currentUser);
    });
    await waitFor(() => expect(view.getByText('Build a profile worth replying to.')).toBeTruthy());
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable error and retries', async () => {
    const bootstrap = jest
      .fn()
      .mockRejectedValueOnce(new Error('The API is temporarily unavailable.'))
      .mockResolvedValueOnce(currentUser);
    const view = await render(
      <CurrentUserBootstrapScreen bootstrap={bootstrap} saveDisplayName={jest.fn()} />,
    );

    await waitFor(() => expect(view.getByText('The API is temporarily unavailable.')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(view.getByText('Build a profile worth replying to.')).toBeTruthy());
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });
});
