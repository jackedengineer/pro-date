import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocationScreen } from './location-screen';

const mumbai = {
  countryCode: 'IN',
  latitude: 19.076,
  locality: 'Mumbai',
  longitude: 72.8777,
  region: 'Maharashtra',
};

describe('LocationScreen', () => {
  it('captures and saves location only after a user action', async () => {
    const captureLocation = jest.fn().mockResolvedValue(mumbai);
    const onSave = jest.fn().mockResolvedValue(undefined);
    const view = await render(<LocationScreen captureLocation={captureLocation} onSave={onSave} />);

    expect(captureLocation).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Use my location' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(mumbai));
  });

  it('keeps a denied permission recoverable', async () => {
    const captureLocation = jest
      .fn()
      .mockRejectedValue(new Error('Location access is needed to show relevant people nearby.'));
    const view = await render(
      <LocationScreen captureLocation={captureLocation} onSave={jest.fn()} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Use my location' }));

    await waitFor(() =>
      expect(view.getByRole('alert')).toHaveTextContent(
        'Location access is needed to show relevant people nearby.',
      ),
    );
    expect(view.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });
});
