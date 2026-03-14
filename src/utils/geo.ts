import type { GeoCenter, GeoBounds } from "../types/location.js";

const EARTH_RADIUS_KM = 6371;

export function haversineDistance(a: GeoCenter, b: GeoCenter): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bboxFromCenter(
  center: GeoCenter,
  radiusKm: number,
): GeoBounds {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));

  return {
    swlat: center.lat - latDelta,
    swlng: center.lng - lngDelta,
    nelat: center.lat + latDelta,
    nelng: center.lng + lngDelta,
  };
}

export function findNearest<T extends { lat: number; lng: number }>(
  items: T[],
  point: GeoCenter,
  n: number,
): T[] {
  return items
    .map((item) => ({
      item,
      distance: haversineDistance(point, { lat: item.lat, lng: item.lng }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n)
    .map((entry) => entry.item);
}
