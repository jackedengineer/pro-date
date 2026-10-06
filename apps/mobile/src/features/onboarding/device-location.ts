import type { LocationUpdate } from '@pro-date/contracts';
import * as Location from 'expo-location';

interface CoarseAddress {
  countryCode: string | null;
  district: string | null;
  locality: string | null;
  region: string | null;
  subregion: string | null;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ProfileLocationServices {
  getCurrentCoordinates: () => Promise<Coordinates>;
  requestForegroundPermission: () => Promise<'denied' | 'granted'>;
  reverseGeocode: (coordinates: Coordinates) => Promise<CoarseAddress | null>;
}

const expoLocationServices: ProfileLocationServices = {
  getCurrentCoordinates: async () => {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  },
  requestForegroundPermission: async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    return permission.granted ? 'granted' : 'denied';
  },
  reverseGeocode: async (coordinates) => {
    const [address] = await Location.reverseGeocodeAsync(coordinates);

    if (address === undefined) {
      return null;
    }

    return {
      countryCode: address.isoCountryCode,
      district: address.district,
      locality: address.city,
      region: address.region,
      subregion: address.subregion,
    };
  },
};

export async function captureProfileLocation(
  services: ProfileLocationServices = expoLocationServices,
): Promise<LocationUpdate> {
  const permission = await services.requestForegroundPermission();

  if (permission !== 'granted') {
    throw new Error('Location access is needed to show relevant people nearby.');
  }

  const coordinates = await services.getCurrentCoordinates();
  const address = await services.reverseGeocode(coordinates);
  const locality = address?.locality ?? address?.district ?? address?.subregion;

  if (address?.countryCode === null || address?.countryCode === undefined || locality == null) {
    throw new Error('We could not identify your city. Check location services and try again.');
  }

  return {
    countryCode: address.countryCode.toUpperCase(),
    latitude: coordinates.latitude,
    locality,
    longitude: coordinates.longitude,
    region: address.region,
  };
}
