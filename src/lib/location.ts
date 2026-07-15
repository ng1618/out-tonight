import { getDb } from "./db";
import { isWithinAnyHome } from "./distance";

export function computeInRange(lat: number | null, lng: number | null): boolean {
  // No known location: don't silently hide it, surface it instead.
  if (lat === null || lng === null) return true;

  const db = getDb();
  const homes = db
    .prepare("SELECT lat, lng, radius_km FROM home_locations")
    .all() as { lat: number; lng: number; radius_km: number }[];

  if (homes.length === 0) return true;

  return isWithinAnyHome(lat, lng, homes);
}
