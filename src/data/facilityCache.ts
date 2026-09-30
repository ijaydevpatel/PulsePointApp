import { Facility } from '../domain/facilities';

const CACHE_MS = 10 * 60 * 1000;
const GRID = 3;

let entry: { key: string; facilities: readonly Facility[]; at: number } | null = null;

export const cacheKey = (lat: number, lon: number) =>
  `${lat.toFixed(GRID)},${lon.toFixed(GRID)}`;

export function readFacilityCache(lat: number, lon: number): readonly Facility[] | null {
  if (!entry || entry.key !== cacheKey(lat, lon)) return null;
  return Date.now() - entry.at <= CACHE_MS ? entry.facilities : null;
}

export function writeFacilityCache(lat: number, lon: number, facilities: readonly Facility[]): void {
  if (facilities.length === 0) return;
  entry = { key: cacheKey(lat, lon), facilities, at: Date.now() };
}
