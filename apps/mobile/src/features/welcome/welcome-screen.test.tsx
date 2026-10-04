import { fireEvent, render } from '@testing-library/react-native';

import { WelcomeScreen } from './welcome-screen';

describe('<WelcomeScreen />', () => {
  it('explains the product and starts onboarding', async () => {
    const onGetStarted = jest.fn();

    const view = await render(<WelcomeScreen onGetStarted={onGetStarted} />);

    expect(view.getByText('ProDate')).toBeTruthy();
    expect(view.getByText('Meet people, not profiles.')).toBeTruthy();
    expect(view.getByText('Thoughtful prompts. Real conversation.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Get started' }));

    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });
});
