import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { geocode } from "@/lib/geocode";

export async function GET() {
  const db = getDb();
  const homes = db.prepare("SELECT * FROM home_locations ORDER BY label").all();
  return NextResponse.json(homes);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { label?: string; place?: string; radiusKm?: number }
    | null;

  const label = body?.label?.trim();
  const place = body?.place?.trim();
  const radiusKm = body?.radiusKm ?? 25;

  if (!label || !place) {
    return NextResponse.json({ error: "label and place are required" }, { status: 400 });
  }

  const geocoded = await geocode(place);
  if (!geocoded) {
    return NextResponse.json({ error: "Could not geocode that place" }, { status: 422 });
  }

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO home_locations (label, lat, lng, radius_km) VALUES (?, ?, ?, ?)"
    )
    .run(label, geocoded.lat, geocoded.lng, radiusKm);

  const home = db
    .prepare("SELECT * FROM home_locations WHERE id = ?")
    .get(result.lastInsertRowid);
  return NextResponse.json(home, { status: 201 });
}
