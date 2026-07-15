import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const series = db.prepare("SELECT * FROM series ORDER BY name").all();
  return NextResponse.json(series);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; matchPattern?: string; venueId?: number; notes?: string }
    | null;

  const name = body?.name?.trim();
  const matchPattern = body?.matchPattern?.trim().toLowerCase();

  if (!name || !matchPattern) {
    return NextResponse.json(
      { error: "name and matchPattern are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO series (name, match_pattern, venue_id, notes, favorited) VALUES (?, ?, ?, ?, 1)"
    )
    .run(name, matchPattern, body?.venueId ?? null, body?.notes ?? null);

  const seriesId = Number(result.lastInsertRowid);

  // Backfill: link + surface any already-ingested events that match this
  // series, regardless of the location filter (favoriting opts them in).
  db.prepare(
    `UPDATE events SET series_id = ?, in_range = 1
     WHERE series_id IS NULL AND lower(title) LIKE '%' || ? || '%'`
  ).run(seriesId, matchPattern);

  const series = db.prepare("SELECT * FROM series WHERE id = ?").get(seriesId);
  return NextResponse.json(series, { status: 201 });
}
