/**
 * Discovery reveals whether a member is inside a viewer-chosen radius of a viewer-chosen point.
 * Storing exact coordinates would let anyone who can move their own location repeat that
 * yes/no probe from several places and trilaterate a member to within metres. Every stored
 * point is therefore a grid vertex, so probes can at best recover the vertex, never the device.
 *
 * Latitude rows are 0.01° apart (~1.11 km). The longitude step widens with latitude so a cell
 * stays ~1.1 km wide away from the equator instead of shrinking toward the poles.
 * Migration 0016_snap-profile-locations applies the same formula to rows saved before this rule.
 */
export const LOCATION_PRIVACY_CELL_DEGREES = 0.01;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

function toFixedDegrees(value: number): number {
  // Six decimals (~0.1 m) removes floating-point noise without moving off the grid.
  return Number(value.toFixed(6)) || 0;
}

export function snapToPrivacyGrid({ latitude, longitude }: Coordinates): Coordinates {
  const step = LOCATION_PRIVACY_CELL_DEGREES;
  const snappedLatitude = Math.min(90, Math.max(-90, Math.round(latitude / step) * step));
  const longitudeStep = Math.min(
    360,
    step / Math.max(Math.cos((snappedLatitude * Math.PI) / 180), 1e-9),
  );
  let snappedLongitude = Math.round(longitude / longitudeStep) * longitudeStep;

  if (snappedLongitude > 180) snappedLongitude -= 360;
  else if (snappedLongitude < -180) snappedLongitude += 360;

  return {
    latitude: toFixedDegrees(snappedLatitude),
    longitude: toFixedDegrees(snappedLongitude),
  };
}
