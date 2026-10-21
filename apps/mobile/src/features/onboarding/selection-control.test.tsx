import { fireEvent, render } from '@testing-library/react-native';
import { triggerFeedback } from '../../theme/feedback';
import { SelectionControl } from './selection-control';

jest.mock('../../theme/feedback', () => ({ triggerFeedback: jest.fn() }));

it('gives selection feedback for a changed choice, without changing its callback', async () => {
  const onPress = jest.fn();
  const view = await render(
    <SelectionControl label="Design" mode="single" selected={false} onPress={onPress} />,
  );
  await fireEvent.press(view.getByRole('radio', { name: 'Design' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(triggerFeedback).toHaveBeenCalledWith('selection');
});

it('does not buzz for an already selected radio or a disabled choice', async () => {
  jest.mocked(triggerFeedback).mockClear();
  const onPress = jest.fn();
  const view = await render(
    <SelectionControl label="Design" mode="single" selected onPress={onPress} />,
  );
  await fireEvent.press(view.getByRole('radio', { name: 'Design' }));
  expect(triggerFeedback).not.toHaveBeenCalled();
  await view.rerender(
    <SelectionControl label="Design" mode="multiple" selected disabled onPress={onPress} />,
  );
  await fireEvent.press(view.getByRole('checkbox', { name: 'Design' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(triggerFeedback).not.toHaveBeenCalled();
});
