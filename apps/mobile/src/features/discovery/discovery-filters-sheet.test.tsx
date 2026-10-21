import { fireEvent, render } from '@testing-library/react-native';
import { DiscoveryFiltersSheet } from './discovery-filters-sheet';

it('exposes the selected distance and preserves the applied filter values', async () => {
  const onApply = jest.fn();
  const view = await render(
    <DiscoveryFiltersSheet
      filters={{ radiusKm: 50, minAge: 21, maxAge: 35 }}
      onClose={jest.fn()}
      onApply={onApply}
    />,
  );
  expect(view.getByRole('radio', { name: '50 km' })).toHaveProp('accessibilityState', {
    checked: true,
  });
  await fireEvent.press(view.getByRole('radio', { name: '100 km' }));
  expect(view.getByRole('radio', { name: '100 km' })).toHaveProp('accessibilityState', {
    checked: true,
  });
  await fireEvent.press(view.getByRole('button', { name: 'Apply preferences' }));
  expect(onApply).toHaveBeenCalledWith({ radiusKm: 100, minAge: 21, maxAge: 35 });
});
