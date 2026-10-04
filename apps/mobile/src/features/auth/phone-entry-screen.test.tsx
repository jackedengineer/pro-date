import { fireEvent, render } from '@testing-library/react-native';

import { PhoneEntryScreen } from './phone-entry-screen';

describe('<PhoneEntryScreen />', () => {
  it('submits a valid Indian phone number in E.164 form', async () => {
    const onBack = jest.fn();
    const onContinue = jest.fn();
    const view = await render(<PhoneEntryScreen onBack={onBack} onContinue={onContinue} />);
    const continueButton = view.getByRole('button', { name: 'Continue' });

    expect(continueButton).toBeDisabled();

    await fireEvent.changeText(view.getByLabelText('Phone number'), '98765 43210');

    expect(view.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith('+919876543210');
  });

  it('keeps continuation disabled for an invalid number', async () => {
    const onContinue = jest.fn();
    const view = await render(<PhoneEntryScreen onBack={jest.fn()} onContinue={onContinue} />);

    await fireEvent.changeText(view.getByLabelText('Phone number'), '123');
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));

    expect(onContinue).not.toHaveBeenCalled();
  });
});
