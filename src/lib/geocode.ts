import { getDb } from "./db";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "out-tonight-personal-app/1.0 (single-user event tracker)";
const MIN_REQUEST_GAP_MS = 1100; // Nominatim usage policy: max 1 req/sec

let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

export type LatLng = { lat: number; lng: number };

export async function geocode(query: string): Promise<LatLng | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const db = getDb();
  const cached = db
    .prepare("SELECT lat, lng FROM geocode_cache WHERE query = ?")
    .get(normalized) as { lat: number | null; lng: number | null } | undefined;

  if (cached) {
    if (cached.lat === null || cached.lng === null) return null;
    return { lat: cached.lat, lng: cached.lng };
  }

  await throttle();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  let result: LatLng | null = null;
  if (res.ok) {
    const body = (await res.json()) as { lat: string; lon: string }[];
    if (body.length > 0) {
      result = { lat: parseFloat(body[0].lat), lng: parseFloat(body[0].lon) };
    }
  }

  db.prepare(
    "INSERT INTO geocode_cache (query, lat, lng) VALUES (?, ?, ?) ON CONFLICT(query) DO UPDATE SET lat = excluded.lat, lng = excluded.lng"
  ).run(normalized, result?.lat ?? null, result?.lng ?? null);

  return result;
}
