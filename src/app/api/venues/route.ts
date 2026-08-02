import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { geocode } from "@/lib/geocode";

export async function GET() {
  const db = getDb();
  const venues = db
    .prepare("SELECT * FROM venues ORDER BY favorited DESC, name COLLATE NOCASE")
    .all();
  return NextResponse.json(venues);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; url?: string; address?: string }
    | null;

  const name = body?.name?.trim();
  const url = body?.url?.trim();
  const address = body?.address?.trim();

  if (!name || !url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (address) {
    const geocoded = await geocode(address);
    lat = geocoded?.lat ?? null;
    lng = geocoded?.lng ?? null;
  }

  const db = getDb();
  try {
    const result = db
      .prepare(
        "INSERT INTO venues (name, url, address, lat, lng) VALUES (?, ?, ?, ?, ?)"
      )
      .run(name, url, address ?? null, lat, lng);
    const venue = db
      .prepare("SELECT * FROM venues WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json(venue, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Venue URL already added" }, { status: 409 });
    }
    throw err;
  }
}
