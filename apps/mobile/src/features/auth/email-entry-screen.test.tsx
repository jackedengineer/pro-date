import { fireEvent, render } from '@testing-library/react-native';

import { EmailEntryScreen } from './email-entry-screen';

describe('<EmailEntryScreen />', () => {
  it('submits a trimmed valid email address', async () => {
    const onContinue = jest.fn();
    const view = await render(
      <EmailEntryScreen onBack={jest.fn()} onContinue={onContinue} onUsePhone={jest.fn()} />,
    );

    expect(view.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await fireEvent.changeText(view.getByLabelText('Email address'), '  priya@example.com  ');

    expect(view.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith('priya@example.com');
  });

  it('keeps continuation disabled for an invalid email address', async () => {
    const onContinue = jest.fn();
    const view = await render(
      <EmailEntryScreen onBack={jest.fn()} onContinue={onContinue} onUsePhone={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByLabelText('Email address'), 'priya@example');
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('offers phone authentication and announces provider failures', async () => {
    const onUsePhone = jest.fn();
    const view = await render(
      <EmailEntryScreen
        errorMessage="We couldn’t send a code right now."
        onBack={jest.fn()}
        onContinue={jest.fn()}
        onUsePhone={onUsePhone}
      />,
    );

    expect(view.getByRole('alert')).toHaveTextContent('We couldn’t send a code right now.');

    await fireEvent.press(view.getByRole('button', { name: 'Use phone instead' }));

    expect(onUsePhone).toHaveBeenCalledTimes(1);
  });
});
