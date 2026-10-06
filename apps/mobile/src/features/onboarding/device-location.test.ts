import { captureProfileLocation, type ProfileLocationServices } from './device-location';

function createLocationServices(
  overrides: Partial<ProfileLocationServices> = {},
): ProfileLocationServices {
  return {
    getCurrentCoordinates: jest.fn().mockResolvedValue({ latitude: 19.076, longitude: 72.8777 }),
    requestForegroundPermission: jest.fn().mockResolvedValue('granted'),
    reverseGeocode: jest.fn().mockResolvedValue({
      countryCode: 'IN',
      district: null,
      locality: 'Mumbai',
      region: 'Maharashtra',
      subregion: 'Mumbai Suburban',
    }),
    ...overrides,
  };
}

describe('captureProfileLocation', () => {
  it('requests foreground access and returns only the profile location fields', async () => {
    const services = createLocationServices();

    await expect(captureProfileLocation(services)).resolves.toEqual({
      countryCode: 'IN',
      latitude: 19.076,
      locality: 'Mumbai',
      longitude: 72.8777,
      region: 'Maharashtra',
    });
    expect(services.requestForegroundPermission).toHaveBeenCalledTimes(1);
  });

  it('uses a district fallback without collecting street or postal details', async () => {
    const services = createLocationServices({
      reverseGeocode: jest.fn().mockResolvedValue({
        countryCode: 'IN',
        district: 'Bengaluru Urban',
        locality: null,
        region: 'Karnataka',
        subregion: null,
      }),
    });

    await expect(captureProfileLocation(services)).resolves.toMatchObject({
      locality: 'Bengaluru Urban',
      region: 'Karnataka',
    });
  });

  it('returns a recoverable error when foreground access is denied', async () => {
    const getCurrentCoordinates = jest.fn();
    const services = createLocationServices({
      getCurrentCoordinates,
      requestForegroundPermission: jest.fn().mockResolvedValue('denied'),
    });

    await expect(captureProfileLocation(services)).rejects.toThrow(
      'Location access is needed to show relevant people nearby.',
    );
    expect(getCurrentCoordinates).not.toHaveBeenCalled();
  });

  it('returns a recoverable error when no coarse place label is available', async () => {
    const services = createLocationServices({ reverseGeocode: jest.fn().mockResolvedValue(null) });

    await expect(captureProfileLocation(services)).rejects.toThrow(
      'We could not identify your city. Check location services and try again.',
    );
  });

  it('does not expose native location errors in the interface', async () => {
    const services = createLocationServices({
      getCurrentCoordinates: jest.fn().mockRejectedValue(new Error('Native provider details')),
    });

    await expect(captureProfileLocation(services)).rejects.toThrow(
      'We could not read your location. Check location services and try again.',
    );
  });
});
