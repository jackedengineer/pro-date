import { fireEvent, render } from '@testing-library/react-native';

import { OtpVerificationScreen } from './otp-verification-screen';

describe('<OtpVerificationScreen />', () => {
  it('submits a complete six-digit verification code without exposing the full phone number', async () => {
    const onSubmit = jest.fn();
    const view = await render(
      <OtpVerificationScreen
        errorMessage={null}
        isSubmitting={false}
        onBack={jest.fn()}
        onResend={jest.fn()}
        onSubmit={onSubmit}
        phoneNumber="+919876543210"
        resendSecondsRemaining={24}
      />,
    );

    expect(view.queryByText('+919876543210')).toBeNull();
    expect(view.getByText('+91 ••••• ••210')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Verify code' })).toBeDisabled();

    await fireEvent.changeText(view.getByLabelText('Verification code'), '12a 34-56');

    expect(view.getByDisplayValue('123456')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Verify code' })).toBeEnabled();
    await fireEvent.press(view.getByRole('button', { name: 'Verify code' }));

    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('announces provider errors and allows another attempt', async () => {
    const view = await render(
      <OtpVerificationScreen
        errorMessage="That code is not correct. Try again."
        isSubmitting={false}
        onBack={jest.fn()}
        onResend={jest.fn()}
        onSubmit={jest.fn()}
        phoneNumber="+919876543210"
        resendSecondsRemaining={0}
      />,
    );

    expect(view.getByRole('alert')).toHaveTextContent('That code is not correct. Try again.');
    expect(view.getByRole('button', { name: 'Send a new code' })).toBeEnabled();
  });

  it('prevents resend and duplicate verification while work is in progress', async () => {
    const onResend = jest.fn();
    const view = await render(
      <OtpVerificationScreen
        errorMessage={null}
        isSubmitting
        onBack={jest.fn()}
        onResend={onResend}
        onSubmit={jest.fn()}
        phoneNumber="+919876543210"
        resendSecondsRemaining={12}
      />,
    );

    expect(view.getByRole('button', { name: 'Verifying code' })).toBeDisabled();
    expect(view.getByRole('button', { name: 'Resend in 12 seconds' })).toBeDisabled();

    await fireEvent.press(view.getByRole('button', { name: 'Resend in 12 seconds' }));

    expect(onResend).not.toHaveBeenCalled();
  });
});
