import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { formatHeight, HeightScreen } from './height-screen';

describe('HeightScreen', () => {
  it('formats metric height with an imperial equivalent', () => {
    expect(formatHeight(173)).toBe('173 cm · 5′ 8″');
  });

  it('saves the selected height and visibility preference', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const view = await render(<HeightScreen onSave={onSave} />);

    await fireEvent(view.getByTestId('height-picker'), 'valueChange', 173);
    await fireEvent(
      view.getByRole('switch', { name: 'Show my height on my profile' }),
      'valueChange',
      false,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Save height and continue' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ centimeters: 173, isVisible: false }),
    );
  });
});
