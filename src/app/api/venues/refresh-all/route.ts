import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { refreshVenue } from "@/lib/ingest";

export async function POST() {
  const db = getDb();
  const venues = db.prepare("SELECT id FROM venues").all() as { id: number }[];

  const results = [];
  for (const venue of venues) {
    const result = await refreshVenue(venue.id);
    results.push({ venueId: venue.id, ...result });
  }

  return NextResponse.json({ refreshed: results.length, results });
}
