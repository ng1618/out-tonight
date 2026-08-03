import { NextRequest, NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "out-tonight-personal-app/1.0 (single-user event tracker)";
const MIN_GAP_MS = 1100; // Nominatim policy: at most 1 request/second

let lastRequestAt = 0;

/**
 * Stateless proxy. It exists only because a browser cannot set the User-Agent
 * header Nominatim requires — no data is stored here; the phone caches results.
 */
export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return NextResponse.json(null);

    const body = (await res.json()) as { lat: string; lon: string }[];
    if (body.length === 0) return NextResponse.json(null);

    return NextResponse.json({
      lat: parseFloat(body[0].lat),
      lng: parseFloat(body[0].lon),
    });
  } catch {
    return NextResponse.json(null);
  }
}
