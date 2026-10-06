import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { BirthdayScreen, getLatestEligibleBirthDate, toCalendarDate } from './birthday-screen';

jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable: MockPressable, Text: MockText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const MockDateTimePicker = ({
    onValueChange,
    testID,
  }: {
    onValueChange: (
      event: { nativeEvent: { timestamp: number; utcOffset: number } },
      date: Date,
    ) => void;
    testID: string;
  }) => (
    <MockPressable
      accessibilityRole="button"
      onPress={() =>
        onValueChange(
          { nativeEvent: { timestamp: new Date(2000, 1, 29).getTime(), utcOffset: 0 } },
          new Date(2000, 1, 29),
        )
      }
      testID={testID}
    >
      <MockText>Mock birthday picker</MockText>
    </MockPressable>
  );

  return {
    __esModule: true,
    DateTimePicker: MockDateTimePicker,
    default: MockDateTimePicker,
  };
});

describe('birthday date helpers', () => {
  it('derives the latest eligible birthday without changing the time of day', () => {
    const today = new Date(2026, 9, 6, 14, 30);

    expect(getLatestEligibleBirthDate(today)).toEqual(new Date(2008, 9, 6, 14, 30));
  });

  it('serializes the local calendar date without a timezone shift', () => {
    expect(toCalendarDate(new Date(2000, 1, 29, 23, 45))).toBe('2000-02-29');
  });
});

describe('BirthdayScreen', () => {
  it('explains privacy and saves the selected calendar date once', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const view = await render(
      <BirthdayScreen onBack={jest.fn()} onSave={onSave} today={new Date(2026, 9, 6)} />,
    );

    expect(view.getByText('One quick age check.')).toBeTruthy();
    expect(view.getByText('ProDate is 18+. We verify that rule on our servers.')).toBeTruthy();
    expect(
      view.getByText('Your full birthday stays private. Only your age appears on your profile.'),
    ).toBeTruthy();

    await fireEvent.press(view.getByTestId('birthday-picker'));
    expect(view.getByText('February 29, 2000')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Save birthday and continue' }));
    expect(onSave).toHaveBeenCalledWith('2000-02-29');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(view.getByRole('button', { name: 'Saving birthday' })).toBeDisabled();

    resolveSave?.();
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Save birthday and continue' })).toBeEnabled(),
    );
  });

  it('keeps the selection available after a recoverable save error', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('The API is unavailable.'));
    const view = await render(
      <BirthdayScreen onBack={jest.fn()} onSave={onSave} today={new Date(2026, 9, 6)} />,
    );

    await fireEvent.press(view.getByTestId('birthday-picker'));
    await fireEvent.press(view.getByRole('button', { name: 'Save birthday and continue' }));

    await waitFor(() =>
      expect(view.getByRole('alert')).toHaveTextContent('The API is unavailable.'),
    );
    expect(view.getByText('February 29, 2000')).toBeTruthy();
  });
});
