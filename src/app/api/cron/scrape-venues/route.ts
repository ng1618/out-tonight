import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { refreshVenue } from "@/lib/ingest";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured, treat as local/dev
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Monthly fallback in case venues weren't refreshed manually. Configure the
// schedule in vercel.json (cron hits this route on the 1st of each month).
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const venues = db.prepare("SELECT id FROM venues").all() as { id: number }[];

  let totalInserted = 0;
  for (const venue of venues) {
    const result = await refreshVenue(venue.id);
    if (result.status === "ok") totalInserted += result.inserted;
  }

  return NextResponse.json({ venuesRefreshed: venues.length, totalInserted });
}
