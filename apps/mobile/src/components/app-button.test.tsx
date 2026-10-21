import { fireEvent, render } from '@testing-library/react-native';
import { AppButton } from './app-button';
import { IconButton } from './icon-button';
import { triggerFeedback } from '../theme/feedback';

jest.mock('../theme/feedback', () => ({ triggerFeedback: jest.fn() }));

describe('core action controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('makes a pending action unavailable and announces its busy state', async () => {
    const onPress = jest.fn();
    const view = await render(<AppButton label="Continue" loading onPress={onPress} />);
    const button = view.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    const props = button.props as { accessibilityState: { busy: boolean } };
    expect(props.accessibilityState.busy).toBe(true);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(triggerFeedback).not.toHaveBeenCalled();
  });

  it('preserves the callback and keeps haptics opt-in', async () => {
    const onPress = jest.fn();
    const view = await render(<AppButton label="Continue" onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(triggerFeedback).not.toHaveBeenCalled();
  });

  it('labels icon-only controls without creating hidden text buttons', async () => {
    const onPress = jest.fn();
    const view = await render(<IconButton label="Go back" icon={() => null} onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Go back' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
