import { describe, expect, it } from 'vitest';

import { snapToPrivacyGrid, type Coordinates } from '../src/location-privacy.js';

const earthRadiusKm = 6371.0088;
function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

const cities: Coordinates[] = [
  { latitude: 19.076, longitude: 72.8777 }, // Mumbai
  { latitude: 1.3521, longitude: 103.8198 }, // Singapore
  { latitude: -33.8688, longitude: 151.2093 }, // Sydney
  { latitude: 51.5072, longitude: -0.1276 }, // London
  { latitude: 64.1466, longitude: -21.9426 }, // Reykjavík
  { latitude: 69.6492, longitude: 18.9553 }, // Tromsø
  { latitude: -54.8019, longitude: -68.303 }, // Ushuaia
];

describe('location privacy grid', () => {
  it('never stores device precision, yet stays within one cell of the device', () => {
    for (const point of cities) {
      const snapped = snapToPrivacyGrid(point);
      expect(snapped).not.toEqual(point);
      expect(distanceKm(point, snapped)).toBeLessThan(0.8);
    }
  });

  it('maps every probe inside a cell to the same stored point', () => {
    const anchor = snapToPrivacyGrid({ latitude: 19.076, longitude: 72.8777 });
    const longitudeStep = 0.01 / Math.cos((anchor.latitude * Math.PI) / 180);
    // Up to ~450 m from the stored point in any direction is indistinguishable to a prober.
    for (const [dLat, dLon] of [
      [0.004, 0],
      [-0.004, 0],
      [0, 0.4 * longitudeStep],
      [0, -0.4 * longitudeStep],
      [0.004, 0.4 * longitudeStep],
    ] as const) {
      expect(
        snapToPrivacyGrid({ latitude: anchor.latitude + dLat, longitude: anchor.longitude + dLon }),
      ).toEqual(anchor);
    }
  });

  it('keeps cells roughly 1.1 km wide away from the equator', () => {
    for (const latitude of [0, 30, 50, 65, 75]) {
      const left = snapToPrivacyGrid({ latitude, longitude: 10 });
      const step = 0.01 / Math.cos((left.latitude * Math.PI) / 180);
      const right = snapToPrivacyGrid({ latitude, longitude: left.longitude + step });
      const width = distanceKm(left, right);
      expect(width).toBeGreaterThan(1.05);
      expect(width).toBeLessThan(1.2);
    }
  });

  it('is idempotent so re-saving or the backfill migration cannot drift a member', () => {
    for (const point of cities) {
      const once = snapToPrivacyGrid(point);
      expect(snapToPrivacyGrid(once)).toEqual(once);
    }
  });

  it('stays inside valid coordinate bounds at the poles and antimeridian', () => {
    for (const point of [
      { latitude: 90, longitude: 179.999 },
      { latitude: -90, longitude: -179.999 },
      { latitude: 89.999, longitude: 45 },
      { latitude: 10, longitude: 179.9999 },
      { latitude: 10, longitude: -179.9999 },
    ]) {
      const snapped = snapToPrivacyGrid(point);
      expect(Math.abs(snapped.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(snapped.longitude)).toBeLessThanOrEqual(180);
      expect(Number.isFinite(snapped.longitude)).toBe(true);
    }
  });
});
