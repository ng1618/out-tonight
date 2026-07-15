import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Daily: reminds about anything marked "going" happening in the next ~24-36h.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const events = db
    .prepare(
      `SELECT * FROM events
       WHERE status = 'going' AND notified_at IS NULL
         AND start_time IS NOT NULL AND start_time >= ? AND start_time <= ?`
    )
    .all(now.toISOString(), windowEnd.toISOString()) as {
    id: number;
    title: string;
    venue_name: string | null;
    url: string | null;
  }[];

  for (const event of events) {
    await sendPushToAll({
      title: event.title,
      body: event.venue_name ? `Tomorrow at ${event.venue_name}` : "Coming up tomorrow",
      url: event.url ?? undefined,
    });
    db.prepare("UPDATE events SET notified_at = datetime('now') WHERE id = ?").run(
      event.id
    );
  }

  return NextResponse.json({ notified: events.length });
}
