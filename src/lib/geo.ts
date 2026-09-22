export type Coordinates = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function milesBetween(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Shortest distance from a point to the straight segment between origin and
 * destination. A crude stand-in for "is this family along the way?" until a
 * real routing API is wired up in geocoding.ts.
 */
export function milesFromSegment(
  point: Coordinates,
  start: Coordinates,
  end: Coordinates,
): number {
  const scaleLng = Math.cos(toRadians((start.lat + end.lat) / 2));
  const px = (point.lng - start.lng) * scaleLng;
  const py = point.lat - start.lat;
  const sx = (end.lng - start.lng) * scaleLng;
  const sy = end.lat - start.lat;
  const lengthSq = sx * sx + sy * sy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / lengthSq));
  const closest: Coordinates = { lat: start.lat + t * sy, lng: start.lng + (t * sx) / scaleLng };
  return milesBetween(point, closest);
}
